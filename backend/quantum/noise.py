"""Custom noise model and noisy simulation runner for QUANTA QAOA.

Owner: Member B (Quantum + benchmarks)
Reference: docs/QUBO_SPEC.md Section 8 and docs/CONTRACTS.md
"""
from __future__ import annotations

import time
from collections.abc import Callable

from qiskit import transpile
from qiskit.circuit.library import QAOAAnsatz
from qiskit_aer import AerSimulator
from qiskit_aer.noise import (
    NoiseModel,
    ReadoutError,
    depolarizing_error,
    thermal_relaxation_error,
)
from qiskit_aer.primitives import SamplerV2

from backend.quantum.bitorder import bits_to_assignment
from backend.quantum.qubo import brute_force, build_qubo, energy, to_ising
from backend.schemas import BitstringCount, QuantumConfig, QuantumResult, SubProblem


def make_noise_model(scale: float = 1.0) -> NoiseModel:
    """Builds an Aer NoiseModel with depolarizing, thermal relaxation, and readout errors.

    Parameters per docs/QUBO_SPEC.md Section 8:
    - Depolarizing: 1e-3 (1-qubit), 1e-2 (2-qubit)
    - Thermal relaxation: T1=120us, T2=90us; gate times 50ns (1q), 400ns (2q)
    - Readout error: 2%
    - Multiplied by scale factor.
    """
    noise_model = NoiseModel()
    if scale <= 1e-9:
        return noise_model

    # Relaxation constants in nanoseconds (120 us, 90 us)
    t1 = 120_000.0
    t2 = 90_000.0
    tg_1q = 50.0
    tg_2q = 400.0

    # Depolarizing errors
    dp_1q = min(0.75, 1e-3 * scale)
    dp_2q = min(0.75, 1e-2 * scale)
    err_dp_1q = depolarizing_error(dp_1q, 1)
    err_dp_2q = depolarizing_error(dp_2q, 2)

    # Thermal relaxation errors
    eff_time_1q = tg_1q * scale
    eff_time_2q = tg_2q * scale
    err_th_1q = thermal_relaxation_error(t1, t2, eff_time_1q)
    err_th_2q = thermal_relaxation_error(t1, t2, eff_time_2q).tensor(
        thermal_relaxation_error(t1, t2, eff_time_2q)
    )

    # Combined gate errors
    err_1q = err_dp_1q.compose(err_th_1q)
    err_2q = err_dp_2q.compose(err_th_2q)

    noise_model.add_all_qubit_quantum_error(err_1q, ["rz", "sx", "x"])
    noise_model.add_all_qubit_quantum_error(err_2q, ["cx"])

    # Readout errors
    p_ro = min(0.5, 0.02 * scale)
    ro_err = ReadoutError([[1.0 - p_ro, p_ro], [p_ro, 1.0 - p_ro]])
    noise_model.add_all_qubit_readout_error(ro_err)

    return noise_model


def run_qaoa_noisy(
    sp: SubProblem,
    cfg: QuantumConfig,
    ideal_result: QuantumResult,
    progress_cb: Callable[[str, float, float | None], None] | None = None,
) -> QuantumResult:
    """Samples pre-optimized QAOA parameters on the Aer noisy simulator without re-optimizing."""
    start_time = time.perf_counter()

    if progress_cb:
        progress_cb("qubo", 0.05, None)
    qp = build_qubo(sp, cfg)

    if progress_cb:
        progress_cb("ising", 0.15, None)
    H, _ = to_ising(qp)

    # Ground truth reference
    bf = brute_force(sp, cfg)
    ground_energy = bf["ground_energy"]
    max_energy = bf["max_energy"]

    # Reconstruct ansatz circuit with ideal parameters (2-level decompose)
    ansatz = QAOAAnsatz(cost_operator=H, reps=cfg.p).decompose().decompose()
    meas_circuit = ansatz.copy()
    meas_circuit.measure_all()
    bound_circuit = meas_circuit.assign_parameters(ideal_result.params)

    # Build noise model and simulator
    noise_scale = cfg.noise_scale if cfg.noise_scale is not None else 1.0
    noise_model = make_noise_model(noise_scale)
    sim = AerSimulator(noise_model=noise_model)

    if progress_cb:
        progress_cb("transpile", 0.30, None)

    transpile_start = time.perf_counter()
    trans_qc = transpile(
        bound_circuit,
        sim,
        optimization_level=2,
    )
    transpile_seconds = float(time.perf_counter() - transpile_start)
    depth = int(trans_qc.depth())
    two_q_gates = int(trans_qc.count_ops().get("cx", 0))

    if progress_cb:
        progress_cb("sample", 0.60, None)

    # Execute with SamplerV2
    sampler = SamplerV2.from_backend(sim, default_shots=cfg.shots)
    samp_job = sampler.run([trans_qc], shots=cfg.shots)
    samp_res = samp_job.result()
    counts = samp_res[0].data.meas.get_counts()

    # Process and normalize bitstrings
    bitstring_records: list[tuple[str, int, float]] = []
    for raw_bits, count in counts.items():
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

    run_seconds = float(time.perf_counter() - start_time)

    if progress_cb:
        progress_cb("done", 1.0, best_sampled)

    return QuantumResult(
        backend="noisy",
        backend_detail=f"AerSimulator (NoiseModel scale={noise_scale:.1f})",
        p=cfg.p,
        shots=cfg.shots,
        params=list(ideal_result.params),
        energy_history=list(ideal_result.energy_history),
        top_bitstrings=top_bitstrings,
        ground_energy=ground_energy,
        best_sampled_energy=best_sampled,
        approx_ratio=approx_ratio,
        depth=depth,
        two_qubit_gates=two_q_gates,
        transpile_seconds=transpile_seconds,
        run_seconds=run_seconds,
        noise_scale=noise_scale,
    )


def noise_sweep(
    sp: SubProblem,
    cfg: QuantumConfig,
    ideal_result: QuantumResult,
    scales: tuple[float, ...] = (0.0, 0.5, 1.0, 2.0),
) -> list[dict]:
    """Sweeps noise scale and evaluates degradation in approximation ratio and mean energy."""
    results: list[dict] = []
    for scale in scales:
        sweep_cfg = cfg.model_copy(update={"noise_scale": scale, "backend": "noisy"})
        res = run_qaoa_noisy(sp, sweep_cfg, ideal_result)

        total_shots = sum(b.count for b in res.top_bitstrings)
        if total_shots > 0:
            mean_energy = sum(b.count * b.energy for b in res.top_bitstrings) / total_shots
        else:
            mean_energy = res.best_sampled_energy

        results.append(
            {
                "scale": scale,
                "approx_ratio": res.approx_ratio,
                "mean_energy": float(mean_energy),
                "best_sampled_energy": res.best_sampled_energy,
                "feasible_hint": res.best_sampled_energy <= sp.baseline_cluster_cost,
            }
        )

    return results
