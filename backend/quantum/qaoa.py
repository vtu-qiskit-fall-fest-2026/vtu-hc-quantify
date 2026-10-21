"""QAOA variational ansatz optimization and sampling using Qiskit V2 primitives.

Owner: Member B (Quantum + benchmarks)
Reference: docs/QUBO_SPEC.md Section 7 and docs/CONTRACTS.md
"""
from __future__ import annotations

import functools
import time
from collections.abc import Callable

import numpy as np
from qiskit import transpile
from qiskit.circuit.library import QAOAAnsatz
from qiskit.primitives import StatevectorEstimator, StatevectorSampler
from qiskit.quantum_info import SparsePauliOp
from qiskit.transpiler import CouplingMap
from scipy.optimize import minimize

from backend.quantum.bitorder import bits_to_assignment
from backend.quantum.qubo import brute_force, build_qubo, energy, to_ising
from backend.schemas import BitstringCount, QuantumConfig, QuantumResult, SubProblem


def _spsa_minimize(
    cost_fn: Callable[[np.ndarray], float],
    theta_init: np.ndarray,
    maxiter: int = 100,
    a: float = 0.2,
    c: float = 0.1,
    alpha: float = 0.602,
    gamma: float = 0.101,
    seed: int = 7,
    progress_callback: Callable[[float, float], None] | None = None,
) -> tuple[np.ndarray, list[float]]:
    """Small SPSA optimizer implementation per docs/QUBO_SPEC.md Section 7."""
    rng = np.random.default_rng(seed)
    theta = np.array(theta_init, dtype=float, copy=True)
    n_params = len(theta)
    A = max(1.0, maxiter / 10.0)
    history: list[float] = []

    for k in range(maxiter):
        a_k = a / ((k + 1 + A) ** alpha)
        c_k = c / ((k + 1) ** gamma)

        delta = rng.choice([-1.0, 1.0], size=n_params)
        y_plus = cost_fn(theta + c_k * delta)
        y_minus = cost_fn(theta - c_k * delta)

        grad = (y_plus - y_minus) / (2.0 * c_k) * delta
        theta -= a_k * grad

        est_val = 0.5 * (y_plus + y_minus)
        history.append(est_val)
        if progress_callback:
            progress_callback((k + 1) / maxiter, est_val)

    return theta, history


def _evaluate_expectation(
    theta: np.ndarray,
    estimator: StatevectorEstimator,
    ansatz: QAOAAnsatz,
    H: SparsePauliOp,
    offset: float,
    trace: list[float],
    r_idx: int,
    m_iter: int,
    tot_restarts: int,
    progress_cb: Callable[[str, float, float | None], None] | None,
) -> float:
    """Evaluates expected energy for given parameters and updates progress trace."""
    job = estimator.run([(ansatz, H, theta)])
    res = job.result()
    exp_val = float(res[0].data.evs)
    tot_energy = exp_val + offset
    trace.append(tot_energy)
    if progress_cb:
        eval_frac = 0.20 + 0.60 * ((r_idx + min(1.0, len(trace) / m_iter)) / tot_restarts)
        progress_cb("optimize", min(0.80, eval_frac), tot_energy)
    return exp_val


def run_qaoa_ideal(
    sp: SubProblem,
    cfg: QuantumConfig,
    progress_cb: Callable[[str, float, float | None], None] | None = None,
) -> QuantumResult:
    """Executes QAOA on the ideal statevector simulator with COBYLA or SPSA."""
    start_time = time.perf_counter()
    n = len(sp.courses)

    if progress_cb:
        progress_cb("qubo", 0.05, None)
    qp = build_qubo(sp, cfg)

    if progress_cb:
        progress_cb("ising", 0.12, None)
    H, offset = to_ising(qp)

    if progress_cb:
        progress_cb("circuit", 0.20, None)

    # Build decomposed QAOA ansatz for direct statevector evaluation
    ansatz = QAOAAnsatz(cost_operator=H, reps=cfg.p).decompose()
    num_params = ansatz.num_parameters
    estimator = StatevectorEstimator()

    # Ground truth oracle for approximation ratio computation
    bf = brute_force(sp, cfg)
    ground_energy = bf["ground_energy"]
    max_energy = bf["max_energy"]

    # Variational optimization
    best_fun = float("inf")
    best_theta: np.ndarray = np.zeros(num_params)
    best_energy_history: list[float] = []

    # Adaptive restarts for large clusters or p=2 to keep runtime under 90s
    restarts = cfg.restarts
    maxiter = cfg.maxiter
    if n >= 12 and cfg.p >= 2:
        restarts = min(restarts, 2)
        maxiter = min(maxiter, 60)
    elif n >= 10:
        restarts = min(restarts, 3)

    for restart_idx in range(restarts):
        restart_seed = cfg.seed + restart_idx * 1337
        restart_rng = np.random.default_rng(restart_seed)

        # Initialize: gamma ~ U[0, pi], beta ~ U[0, pi/2]
        init_theta = np.zeros(num_params)
        for p_idx, param in enumerate(ansatz.parameters):
            p_name = param.name
            if "gamma" in p_name or "\u03b3" in p_name:
                init_theta[p_idx] = restart_rng.uniform(0.0, np.pi)
            else:
                init_theta[p_idx] = restart_rng.uniform(0.0, np.pi / 2.0)

        run_trace: list[float] = []
        cost_fn = functools.partial(
            _evaluate_expectation,
            estimator=estimator,
            ansatz=ansatz,
            H=H,
            offset=offset,
            trace=run_trace,
            r_idx=restart_idx,
            m_iter=maxiter,
            tot_restarts=restarts,
            progress_cb=progress_cb,
        )

        if cfg.optimizer == "SPSA":
            opt_theta, _ = _spsa_minimize(
                cost_fn,
                init_theta,
                maxiter=maxiter,
                seed=restart_seed,
            )
            final_val = cost_fn(opt_theta)
        else:
            opt_res = minimize(
                cost_fn,
                init_theta,
                method="COBYLA",
                options={"maxiter": maxiter},
            )
            opt_theta = opt_res.x
            final_val = opt_res.fun

        if final_val < best_fun:
            best_fun = final_val
            best_theta = opt_theta
            best_energy_history = list(run_trace)

    # Quantum state sampling
    if progress_cb:
        progress_cb("sample", 0.82, best_fun + offset)

    meas_circuit = ansatz.copy()
    meas_circuit.measure_all()
    bound_circuit = meas_circuit.assign_parameters(best_theta)

    sampler = StatevectorSampler(default_shots=cfg.shots)
    samp_job = sampler.run([bound_circuit], shots=cfg.shots)
    samp_result = samp_job.result()
    counts = samp_result[0].data.meas.get_counts()

    # Normalize bitstrings (Qiskit rightmost char = qubit 0) and attach classical energy
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

    best_sampled = min((item[2] for item in bitstring_records), default=best_fun + offset)
    denom = max(1e-9, max_energy - ground_energy)
    approx_ratio = float((max_energy - best_sampled) / denom)

    # Transpilation metrics (CouplingMap line chain representing heavy-hex segment)
    if progress_cb:
        progress_cb("transpile", 0.92, None)

    transpile_start = time.perf_counter()
    cmap = CouplingMap.from_line(n)
    trans_qc = transpile(
        bound_circuit,
        basis_gates=["cx", "rz", "sx", "x"],
        coupling_map=cmap,
        optimization_level=3,
    )
    transpile_seconds = float(time.perf_counter() - transpile_start)
    depth = int(trans_qc.depth())
    two_q_gates = int(trans_qc.count_ops().get("cx", 0))

    run_seconds = float(time.perf_counter() - start_time)

    if progress_cb:
        progress_cb("done", 1.0, best_sampled)

    return QuantumResult(
        backend="ideal",
        backend_detail="StatevectorEstimator + StatevectorSampler (Qiskit V2)",
        p=cfg.p,
        shots=cfg.shots,
        params=[float(v) for v in best_theta],
        energy_history=best_energy_history,
        top_bitstrings=top_bitstrings,
        ground_energy=ground_energy,
        best_sampled_energy=best_sampled,
        approx_ratio=approx_ratio,
        depth=depth,
        two_qubit_gates=two_q_gates,
        transpile_seconds=transpile_seconds,
        run_seconds=run_seconds,
    )
