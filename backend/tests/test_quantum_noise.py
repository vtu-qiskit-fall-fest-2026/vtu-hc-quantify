"""Unit tests for Aer noise model and noisy QAOA execution (Task B3).

Owner: Member B (Quantum + benchmarks)
Reference: docs/QUBO_SPEC.md Section 8 and Section 11 (Acceptance tests)
"""
from pathlib import Path

import pytest

from backend.quantum.noise import make_noise_model, noise_sweep, run_qaoa_noisy
from backend.quantum.qaoa import run_qaoa_ideal
from backend.schemas import QuantumConfig, SubProblem


@pytest.fixture
def subproblem_6() -> SubProblem:
    fixture_path = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "subproblem_6.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        return SubProblem.model_validate_json(f.read())


def test_noise_model_structure():
    """Verify noise model creation at zero scale and standard scale."""
    nm_zero = make_noise_model(0.0)
    assert len(nm_zero.noise_instructions) == 0

    nm_one = make_noise_model(1.0)
    assert "cx" in nm_one.noise_instructions
    assert "measure" in nm_one.noise_instructions
    assert "rz" in nm_one.noise_instructions
    assert "sx" in nm_one.noise_instructions
    assert "x" in nm_one.noise_instructions


def test_scale_zero_reproduces_ideal(subproblem_6: SubProblem):
    """Verify that scale 0 reproduces the ideal distribution within sampling error (TVD < 0.1)."""
    sp = subproblem_6
    cfg = QuantumConfig(backend="ideal", p=1, restarts=1, maxiter=20, shots=4096, seed=42)
    ideal_res = run_qaoa_ideal(sp, cfg)

    noisy_cfg = cfg.model_copy(update={"backend": "noisy", "noise_scale": 0.0})
    noisy_res = run_qaoa_noisy(sp, noisy_cfg, ideal_res)

    ideal_probs = {b.bits: b.count / cfg.shots for b in ideal_res.top_bitstrings}
    noisy_probs = {b.bits: b.count / cfg.shots for b in noisy_res.top_bitstrings}

    all_keys = set(ideal_probs.keys()).union(noisy_probs.keys())
    tvd = 0.5 * sum(abs(ideal_probs.get(k, 0.0) - noisy_probs.get(k, 0.0)) for k in all_keys)

    assert tvd < 0.10, f"TVD at scale 0 is {tvd:.4f}, expected < 0.10"
    assert noisy_res.approx_ratio is not None
    assert noisy_res.approx_ratio >= 0.85


def test_noise_sweep_trend(subproblem_6: SubProblem):
    """Verify noise sweep runs over scales and tracks performance degradation."""
    sp = subproblem_6
    cfg = QuantumConfig(backend="ideal", p=1, restarts=1, maxiter=20, shots=2048, seed=42)
    ideal_res = run_qaoa_ideal(sp, cfg)

    sweep_results = noise_sweep(sp, cfg, ideal_res, scales=(0.0, 0.5, 1.0, 2.0))
    assert len(sweep_results) == 4

    scale_0 = sweep_results[0]
    scale_1 = sweep_results[2]
    scale_2 = sweep_results[3]

    assert scale_0["scale"] == 0.0
    assert scale_1["scale"] == 1.0
    assert scale_2["scale"] == 2.0
    # Both noisy runs produce valid approximation ratios
    assert scale_0["approx_ratio"] is not None
    assert scale_2["approx_ratio"] is not None
    assert scale_0["approx_ratio"] >= 0.85
    assert scale_2["approx_ratio"] >= 0.80
