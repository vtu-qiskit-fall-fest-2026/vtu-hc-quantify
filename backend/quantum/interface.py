"""Public unified interface for quantum execution (Member B).

Called by backend/api/jobs.py and classical-quantum orchestrators.
Dispatches to ideal statevector simulator, Aer noisy model, or IBM Quantum hardware.
Certified thread-safe with zero module-level mutable state.
"""
from __future__ import annotations

from collections.abc import Callable

from dotenv import load_dotenv

from backend.quantum.ibm import run_qaoa_ibm
from backend.quantum.noise import run_qaoa_noisy
from backend.quantum.qaoa import run_qaoa_ideal
from backend.schemas import QuantumConfig, QuantumResult, SubProblem

load_dotenv()


class QuantumBackendError(RuntimeError):
    """Raised when quantum backend execution, optimization, or hardware communication fails."""


def run_quantum(
    sp: SubProblem,
    cfg: QuantumConfig,
    progress_cb: Callable[[str, float, float | None], None] | None = None,
) -> QuantumResult:
    """Thread-safe entry point for running QAOA across target backends.

    Stages emitted to progress_cb:
        'qubo', 'ising', 'circuit', 'optimize', 'sample', 'transpile', 'queue' (ibm only), 'done'
    """
    valid_backends = {"ideal", "noisy", "fake_ibm", "ibm"}
    if cfg.backend not in valid_backends:
        raise ValueError(
            f"Unsupported quantum backend '{cfg.backend}'. Valid options: {sorted(valid_backends)}"
        )

    try:
        if cfg.backend == "ideal":
            return run_qaoa_ideal(sp, cfg, progress_cb)

        elif cfg.backend == "noisy":
            # Stage 1: Parameter optimization on ideal simulator (0.0 -> 0.50)
            def ideal_cb(stage: str, frac: float, val: float | None) -> None:
                if progress_cb and stage != "done":
                    scaled_frac = frac * 0.50
                    progress_cb(stage, scaled_frac, val)

            ideal_res = run_qaoa_ideal(sp, cfg, ideal_cb)

            # Stage 2: Aer noisy simulation & sampling (0.50 -> 1.0)
            def noisy_cb(stage: str, frac: float, val: float | None) -> None:
                if progress_cb:
                    scaled_frac = 0.50 + frac * 0.50
                    progress_cb(stage, min(1.0, scaled_frac), val)

            return run_qaoa_noisy(sp, cfg, ideal_res, noisy_cb)

        elif cfg.backend == "fake_ibm":
            # Stage 1: Ideal optimization (0.0 -> 0.50)
            def fake_ideal_cb(stage: str, frac: float, val: float | None) -> None:
                if progress_cb and stage != "done":
                    scaled_frac = frac * 0.50
                    progress_cb(stage, scaled_frac, val)

            ideal_res = run_qaoa_ideal(sp, cfg, fake_ideal_cb)

            # Stage 2: Offline FakeAuckland sampling (0.50 -> 1.0)
            def fake_ibm_cb(stage: str, frac: float, val: float | None) -> None:
                if progress_cb:
                    scaled_frac = 0.50 + frac * 0.50
                    progress_cb(stage, min(1.0, scaled_frac), val)

            return run_qaoa_ibm(sp, cfg, ideal_res, fake_ibm_cb, dry_run=True)

        elif cfg.backend == "ibm":
            # Fast check for token before spending simulator runtime
            import os

            if not os.getenv("IBM_QUANTUM_TOKEN"):
                raise QuantumBackendError(
                    "Missing IBM_QUANTUM_TOKEN in environment or .env file. "
                    "Configure token or run with backend='fake_ibm'."
                )

            # Stage 1: Ideal parameter optimization (0.0 -> 0.30)
            def live_ideal_cb(stage: str, frac: float, val: float | None) -> None:
                if progress_cb and stage != "done":
                    scaled_frac = frac * 0.30
                    progress_cb(stage, scaled_frac, val)

            ideal_res = run_qaoa_ideal(sp, cfg, live_ideal_cb)

            # Stage 2: Physical IBM QPU transpilation, queueing, and sampling (0.30 -> 1.0)
            def live_ibm_cb(stage: str, frac: float, val: float | None) -> None:
                if progress_cb:
                    scaled_frac = 0.30 + frac * 0.70
                    progress_cb(stage, min(1.0, scaled_frac), val)

            return run_qaoa_ibm(sp, cfg, ideal_res, live_ibm_cb, dry_run=False)

        else:
            raise ValueError(f"Unhandled backend: {cfg.backend}")

    except QuantumBackendError:
        raise
    except Exception as exc:
        raise QuantumBackendError(
            f"Quantum execution failed on backend '{cfg.backend}': {exc}"
        ) from exc
