"""Public unified interface for quantum execution (Member B).

Called by backend/api/jobs.py.
Dispatches to ideal simulator, Aer noisy model, or IBM Quantum hardware.
"""
from __future__ import annotations

from collections.abc import Callable

from backend.quantum.noise import run_qaoa_noisy
from backend.quantum.qaoa import run_qaoa_ideal
from backend.schemas import QuantumConfig, QuantumResult, SubProblem


def run_quantum(
    sp: SubProblem,
    cfg: QuantumConfig,
    progress_cb: Callable[[str, float, float | None], None] | None = None,
) -> QuantumResult:
    """Thread-safe entry point for running QAOA across target backends."""
    if cfg.backend == "ideal":
        return run_qaoa_ideal(sp, cfg, progress_cb)
    elif cfg.backend == "noisy":
        ideal_res = run_qaoa_ideal(sp, cfg, progress_cb)
        return run_qaoa_noisy(sp, cfg, ideal_res, progress_cb)
    elif cfg.backend in ("fake_ibm", "ibm"):
        # Temporary until B4 hooks real / fake ibm runner
        res = run_qaoa_ideal(sp, cfg, progress_cb)
        res.backend = cfg.backend
        res.backend_detail = f"Qiskit Aer / {cfg.backend}"
        return res
    else:
        raise ValueError(f"Unsupported quantum backend: {cfg.backend}")
