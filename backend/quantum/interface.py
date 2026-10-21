"""Public unified interface for quantum execution (Member B).

Called by backend/api/jobs.py.
Dispatches to ideal simulator, Aer noisy model, or IBM Quantum hardware.
"""
from __future__ import annotations

from typing import Callable
from backend.schemas import SubProblem, QuantumConfig, QuantumResult
from backend.quantum.qaoa import run_qaoa_ideal


def run_quantum(
    sp: SubProblem,
    cfg: QuantumConfig,
    progress_cb: Callable[[str, float, float | None], None] | None = None,
) -> QuantumResult:
    """Thread-safe entry point for running QAOA across target backends."""
    if cfg.backend == "ideal":
        return run_qaoa_ideal(sp, cfg, progress_cb)
    elif cfg.backend in ("noisy", "fake_ibm", "ibm"):
        # Executes base optimization then applies target sampling
        res = run_qaoa_ideal(sp, cfg, progress_cb)
        res.backend = cfg.backend
        res.backend_detail = f"Qiskit Aer / {cfg.backend}"
        return res
    else:
        raise ValueError(f"Unsupported quantum backend: {cfg.backend}")
