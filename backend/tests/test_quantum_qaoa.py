"""Unit tests for QAOA variational optimization and sampling (Task B2).

Owner: Member B (Quantum + benchmarks)
Reference: docs/QUBO_SPEC.md Section 7 and Section 11 (Acceptance tests)
"""
from pathlib import Path

import pytest

from backend.quantum.qaoa import run_qaoa_ideal
from backend.quantum.qubo import energy
from backend.schemas import QuantumConfig, SubProblem


@pytest.fixture
def subproblem_6() -> SubProblem:
    fixture_path = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "subproblem_6.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        return SubProblem.model_validate_json(f.read())


def test_qaoa_ideal_p1_approx_ratio(subproblem_6: SubProblem):
    """Acceptance test: p=1 on 6-qubit fixture reaches approx_ratio >= 0.85 with fixed seed."""
    sp = subproblem_6
    cfg = QuantumConfig(
        backend="ideal",
        p=1,
        optimizer="COBYLA",
        restarts=3,
        maxiter=60,
        shots=4096,
        seed=42,
    )

    progress_events = []

    def progress_cb(stage: str, frac: float, val: float | None):
        progress_events.append((stage, frac, val))

    result = run_qaoa_ideal(sp, cfg, progress_cb=progress_cb)

    assert result.backend == "ideal"
    assert result.p == 1
    assert result.approx_ratio is not None
    assert result.approx_ratio >= 0.85, f"Approximation ratio {result.approx_ratio} < 0.85"
    assert result.best_sampled_energy >= result.ground_energy
    assert len(result.top_bitstrings) > 0
    assert result.depth > 0
    assert result.two_qubit_gates > 0
    assert len(progress_events) > 0
    assert any(ev[0] == "optimize" for ev in progress_events)
    assert any(ev[0] == "done" for ev in progress_events)


def test_qaoa_ideal_p2_comparison(subproblem_6: SubProblem):
    """Compare p=2 against p=1 and ensure approx_ratio remains high."""
    sp = subproblem_6
    cfg_p1 = QuantumConfig(backend="ideal", p=1, restarts=2, maxiter=40, seed=10)
    cfg_p2 = QuantumConfig(backend="ideal", p=2, restarts=2, maxiter=40, seed=10)

    res_p1 = run_qaoa_ideal(sp, cfg_p1)
    res_p2 = run_qaoa_ideal(sp, cfg_p2)

    assert res_p1.approx_ratio is not None
    assert res_p2.approx_ratio is not None
    assert res_p2.approx_ratio >= 0.80
    assert res_p2.depth >= res_p1.depth
    assert res_p2.two_qubit_gates >= res_p1.two_qubit_gates


def test_qaoa_bitorder_consistency(subproblem_6: SubProblem):
    """Verify top-sampled bitstrings match direct classical energy evaluation."""
    sp = subproblem_6
    cfg = QuantumConfig(backend="ideal", p=1, restarts=2, maxiter=30, seed=7)
    res = run_qaoa_ideal(sp, cfg)

    for item in res.top_bitstrings[:5]:
        # item.bits is already normalized where bits[i] is course i
        assignment = [int(ch) for ch in item.bits]
        classical_e = energy(sp, cfg, assignment)
        assert abs(item.energy - classical_e) < 1e-9


def test_qaoa_spsa_optimizer(subproblem_6: SubProblem):
    """Verify that SPSA optimizer option executes successfully."""
    sp = subproblem_6
    cfg = QuantumConfig(
        backend="ideal",
        p=1,
        optimizer="SPSA",
        restarts=1,
        maxiter=30,
        shots=1024,
        seed=123,
    )
    res = run_qaoa_ideal(sp, cfg)
    assert res.approx_ratio is not None
    assert len(res.top_bitstrings) > 0
    assert res.run_seconds > 0.0
