"""IBM Quantum hardware integration and offline FakeBackend runner for QUANTA.

Owner: Member B (Quantum + benchmarks)
Reference: docs/QUBO_SPEC.md Section 9 and docs/CONTRACTS.md
"""
from __future__ import annotations

import datetime
import json
import os
import time
from collections.abc import Callable
from pathlib import Path

from dotenv import load_dotenv
from qiskit.circuit.library import QAOAAnsatz
from qiskit.transpiler.preset_passmanagers import generate_preset_pass_manager
from qiskit_aer import AerSimulator
from qiskit_aer.primitives import SamplerV2 as AerSamplerV2
from qiskit_ibm_runtime import QiskitRuntimeService
from qiskit_ibm_runtime import SamplerV2 as RuntimeSamplerV2
from qiskit_ibm_runtime.fake_provider import FakeAuckland

from backend.quantum.bitorder import bits_to_assignment
from backend.quantum.qubo import brute_force, build_qubo, energy, to_ising
from backend.schemas import BitstringCount, QuantumConfig, QuantumResult, SubProblem

load_dotenv()


def run_qaoa_ibm(
    sp: SubProblem,
    cfg: QuantumConfig,
    ideal_result: QuantumResult,
    progress_cb: Callable[[str, float, float | None], None] | None = None,
    dry_run: bool = False,
) -> QuantumResult:
    """Executes QAOA on IBM physical hardware or offline FakeBackend emulator.

    - dry_run=True (or cfg.backend == 'fake_ibm') emulates hardware offline using FakeAuckland.
    - dry_run=False submits a real physical QPU job to the least-busy IBM backend.
    """
    start_time = time.perf_counter()
    n = len(sp.courses)

    if progress_cb:
        progress_cb("qubo", 0.05, None)
    qp = build_qubo(sp, cfg)

    if progress_cb:
        progress_cb("ising", 0.12, None)
    H, _ = to_ising(qp)

    # Reference ground truth
    bf = brute_force(sp, cfg)
    ground_energy = bf["ground_energy"]
    max_energy = bf["max_energy"]

    # Reconstruct bound ansatz circuit (2-level decompose)
    ansatz = QAOAAnsatz(cost_operator=H, reps=cfg.p).decompose().decompose()
    meas_circuit = ansatz.copy()
    meas_circuit.measure_all()
    bound_circuit = meas_circuit.assign_parameters(ideal_result.params)

    # Determine execution mode: offline FakeBackend vs real physical hardware
    is_offline = dry_run or (cfg.backend == "fake_ibm")

    if is_offline:
        # Offline path via FakeAuckland + AerSimulator
        fake_backend = FakeAuckland()
        backend_name = fake_backend.name
        num_qubits = fake_backend.num_qubits

        if progress_cb:
            progress_cb("transpile", 0.30, None)
        transpile_start = time.perf_counter()
        pm = generate_preset_pass_manager(backend=fake_backend, optimization_level=3)
        isa_circuit = pm.run(bound_circuit)
        transpile_seconds = float(time.perf_counter() - transpile_start)

        sim = AerSimulator.from_backend(fake_backend)
        sampler = AerSamplerV2.from_backend(sim, default_shots=cfg.shots)

        if progress_cb:
            progress_cb("sample", 0.60, None)

        job_id = f"job_fake_auckland_{int(time.time())}"
        queue_seconds = 0.0

        samp_job = sampler.run([isa_circuit], shots=cfg.shots)
        samp_result = samp_job.result()
        raw_counts = samp_result[0].data.meas.get_counts()
    else:
        # Live physical hardware path
        token = os.getenv("IBM_QUANTUM_TOKEN")
        instance = os.getenv("IBM_QUANTUM_INSTANCE")

        if not token:
            raise ValueError(
                "Missing IBM_QUANTUM_TOKEN in environment or .env file. "
                "Configure token or run with dry_run=True / backend='fake_ibm'."
            )

        if progress_cb:
            progress_cb("queue", 0.20, None)

        service = QiskitRuntimeService(
            channel="ibm_quantum_platform",
            token=token,
            instance=instance,
        )
        backend = service.least_busy(operational=True, simulator=False, min_num_qubits=n)
        backend_name = backend.name
        num_qubits = backend.num_qubits

        if progress_cb:
            progress_cb("transpile", 0.35, None)

        transpile_start = time.perf_counter()
        pm = generate_preset_pass_manager(backend=backend, optimization_level=3)
        isa_circuit = pm.run(bound_circuit)
        transpile_seconds = float(time.perf_counter() - transpile_start)

        if progress_cb:
            progress_cb("queue", 0.50, None)

        queue_start = time.perf_counter()
        sampler = RuntimeSamplerV2(mode=backend)
        job = sampler.run([isa_circuit], shots=cfg.shots)
        job_id = job.job_id()

        # Poll status
        while not job.done():
            time.sleep(2.0)
            if progress_cb:
                progress_cb("queue", 0.60, None)

        queue_seconds = float(time.perf_counter() - queue_start)

        if progress_cb:
            progress_cb("sample", 0.85, None)

        result = job.result()
        raw_counts = result[0].data.meas.get_counts()

    # Process and normalize bitstrings
    bitstring_records: list[tuple[str, int, float]] = []
    for raw_bits, count in raw_counts.items():
        assignment = bits_to_assignment(raw_bits)
        norm_bits = "".join(str(v) for v in assignment)
        cost_val = energy(sp, cfg, assignment)
        bitstring_records.append((norm_bits, int(count), cost_val))

    bitstring_records.sort(key=lambda item: item[1], reverse=True)
    top_bitstrings = [
        BitstringCount(bits=item[0], count=item[1], energy=item[2])
        for item in bitstring_records[:32]
    ]

    best_sampled = min((item[2] for item in bitstring_records), default=max_energy)
    denom = max(1e-9, max_energy - ground_energy)
    approx_ratio = float((max_energy - best_sampled) / denom)

    depth = int(isa_circuit.depth())
    two_q_gates = int(isa_circuit.count_ops().get("cx", 0) + isa_circuit.count_ops().get("ecr", 0) + isa_circuit.count_ops().get("cz", 0))
    run_seconds = float(time.perf_counter() - start_time)

    # Persist hardware telemetry artifact to runs/hardware/<UTC-timestamp>.json
    now_utc = datetime.datetime.now(datetime.UTC)
    timestamp_str = now_utc.strftime("%Y%m%d_%H%M%S")
    hardware_dir = Path("runs") / "hardware"
    hardware_dir.mkdir(parents=True, exist_ok=True)
    telemetry_file = hardware_dir / f"{timestamp_str}.json"

    telemetry_payload = {
        "timestamp": now_utc.isoformat(),
        "backend_name": backend_name,
        "num_qubits": num_qubits,
        "job_id": job_id,
        "is_dry_run": is_offline,
        "queue_seconds": queue_seconds,
        "run_seconds": run_seconds,
        "depth": depth,
        "two_qubit_gates": two_q_gates,
        "params": [float(p) for p in ideal_result.params],
        "shots": cfg.shots,
        "approx_ratio": approx_ratio,
        "ground_energy": ground_energy,
        "best_sampled_energy": best_sampled,
        "counts": raw_counts,
    }

    with open(telemetry_file, "w", encoding="utf-8") as f:
        json.dump(telemetry_payload, f, indent=2)

    if progress_cb:
        progress_cb("done", 1.0, best_sampled)

    backend_label = "fake_ibm" if is_offline else "ibm"
    return QuantumResult(
        backend=backend_label,
        backend_detail=f"{backend_name} ({'Emulator' if is_offline else 'Physical QPU'}, {num_qubits} qubits)",
        p=cfg.p,
        shots=cfg.shots,
        params=[float(p) for p in ideal_result.params],
        energy_history=list(ideal_result.energy_history),
        top_bitstrings=top_bitstrings,
        ground_energy=ground_energy,
        best_sampled_energy=best_sampled,
        approx_ratio=approx_ratio,
        depth=depth,
        two_qubit_gates=two_q_gates,
        transpile_seconds=transpile_seconds,
        run_seconds=run_seconds,
        queue_seconds=queue_seconds,
        job_id=job_id,
    )
