"""Unit tests for Member B's public quantum interface (HO-03)."""
from __future__ import annotations

import concurrent.futures
import json
from pathlib import Path

import pytest

from backend.quantum.interface import QuantumBackendError, run_quantum
from backend.schemas import QuantumConfig, SubProblem


@pytest.fixture
def subproblem_6() -> SubProblem:
    path = Path("data/fixtures/subproblem_6.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return SubProblem(**data)


def test_interface_ideal_backend(subproblem_6: SubProblem) -> None:
    """Tests ideal statevector execution via the public interface."""
    recorded_stages: list[str] = []

    def callback(stage: str, frac: float, val: float | None) -> None:
        recorded_stages.append(stage)

    cfg = QuantumConfig(backend="ideal", p=1, shots=512, seed=42, maxiter=20, restarts=1)
    res = run_quantum(subproblem_6, cfg, callback)

    assert res.backend == "ideal"
    assert res.p == 1
    assert res.shots == 512
    assert res.approx_ratio >= 0.70
    assert len(res.top_bitstrings) > 0
    assert all(len(item.bits) == 6 for item in res.top_bitstrings)

    # Check stage sequence
    for expected_stage in ["qubo", "ising", "circuit", "optimize", "sample", "transpile", "done"]:
        assert expected_stage in recorded_stages


def test_interface_noisy_backend(subproblem_6: SubProblem) -> None:
    """Tests Aer noise simulation via the public interface."""
    recorded_stages: list[str] = []

    def callback(stage: str, frac: float, val: float | None) -> None:
        recorded_stages.append(stage)

    cfg = QuantumConfig(
        backend="noisy",
        p=1,
        shots=512,
        seed=42,
        noise_scale=0.5,
        maxiter=15,
        restarts=1,
    )
    res = run_quantum(subproblem_6, cfg, callback)

    assert res.backend == "noisy"
    assert res.shots == 512
    assert len(res.top_bitstrings) > 0
    assert "done" in recorded_stages


def test_interface_fake_ibm_backend(subproblem_6: SubProblem) -> None:
    """Tests offline FakeAuckland IBM emulator via the public interface."""
    cfg = QuantumConfig(
        backend="fake_ibm",
        p=1,
        shots=512,
        seed=42,
        maxiter=15,
        restarts=1,
    )
    res = run_quantum(subproblem_6, cfg)

    assert res.backend == "fake_ibm"
    assert "fake_auckland" in res.backend_detail
    assert res.shots == 512
    assert res.approx_ratio is not None


def test_interface_invalid_backend(subproblem_6: SubProblem) -> None:
    """Tests rejection of invalid backend specifiers."""
    cfg = QuantumConfig(backend="ideal")
    object.__setattr__(cfg, "backend", "unsupported_backend")
    with pytest.raises((ValueError, QuantumBackendError)):
        run_quantum(subproblem_6, cfg)


def test_interface_missing_token_error_wrapping(subproblem_6: SubProblem, monkeypatch: pytest.MonkeyPatch) -> None:
    """Verifies that missing IBM tokens are wrapped into QuantumBackendError."""
    monkeypatch.delenv("IBM_QUANTUM_TOKEN", raising=False)
    cfg = QuantumConfig(backend="ibm", p=1, shots=100)
    with pytest.raises(QuantumBackendError) as exc_info:
        run_quantum(subproblem_6, cfg)
    assert "Missing IBM_QUANTUM_TOKEN" in str(exc_info.value)


def test_interface_thread_safety(subproblem_6: SubProblem) -> None:
    """Tests concurrent execution across worker threads with zero shared mutable state."""
    cfg1 = QuantumConfig(backend="ideal", p=1, shots=256, seed=10, maxiter=10, restarts=1)
    cfg2 = QuantumConfig(backend="ideal", p=1, shots=256, seed=20, maxiter=10, restarts=1)

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(run_quantum, subproblem_6, cfg1)
        f2 = executor.submit(run_quantum, subproblem_6, cfg2)
        r1 = f1.result()
        r2 = f2.result()

    assert r1.backend == "ideal"
    assert r2.backend == "ideal"
    assert r1.shots == 256
    assert r2.shots == 256
