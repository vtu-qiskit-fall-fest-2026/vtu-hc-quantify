"""Unit tests for IBM Quantum hardware runner and offline FakeBackend (Task B4).

Owner: Member B (Quantum + benchmarks)
Reference: docs/QUBO_SPEC.md Section 9 and Section 11 (Acceptance tests)
"""
import json
from pathlib import Path

import pytest

from backend.quantum.ibm import run_qaoa_ibm
from backend.quantum.qaoa import run_qaoa_ideal
from backend.schemas import QuantumConfig, SubProblem


@pytest.fixture
def subproblem_6() -> SubProblem:
    fixture_path = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "subproblem_6.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        return SubProblem.model_validate_json(f.read())


def test_ibm_dry_run_offline_execution(subproblem_6: SubProblem):
    """Verify offline dry run with FakeAuckland runs cleanly and saves telemetry artifact."""
    sp = subproblem_6
    cfg = QuantumConfig(backend="ideal", p=1, restarts=1, maxiter=20, shots=1024, seed=42)
    ideal_res = run_qaoa_ideal(sp, cfg)

    hw_cfg = cfg.model_copy(update={"backend": "fake_ibm"})
    hw_res = run_qaoa_ibm(sp, hw_cfg, ideal_res, dry_run=True)

    assert hw_res.backend == "fake_ibm"
    assert "fake_auckland" in hw_res.backend_detail
    assert hw_res.job_id is not None
    assert "fake" in hw_res.job_id
    assert hw_res.approx_ratio is not None
    assert hw_res.approx_ratio >= 0.80
    assert hw_res.depth > 0
    assert hw_res.two_qubit_gates > 0
    assert len(hw_res.top_bitstrings) > 0

    # Verify telemetry file was persisted to runs/hardware/
    hardware_dir = Path("runs") / "hardware"
    json_files = list(hardware_dir.glob("*.json"))
    assert len(json_files) > 0

    latest_file = max(json_files, key=lambda p: p.stat().st_mtime)
    with open(latest_file, "r", encoding="utf-8") as f:
        telemetry = json.load(f)
        assert telemetry["backend_name"] == "fake_auckland"
        assert telemetry["is_dry_run"] is True
        assert telemetry["shots"] == hw_cfg.shots
        assert "counts" in telemetry


def test_missing_token_raises_clear_error(monkeypatch: pytest.MonkeyPatch, subproblem_6: SubProblem):
    """Verify missing IBM_QUANTUM_TOKEN raises readable ValueError without leaking secrets."""
    monkeypatch.delenv("IBM_QUANTUM_TOKEN", raising=False)
    monkeypatch.setenv("IBM_QUANTUM_TOKEN", "")

    sp = subproblem_6
    cfg = QuantumConfig(backend="ibm", p=1, restarts=1, maxiter=10)
    ideal_res = run_qaoa_ideal(sp, cfg)

    with pytest.raises(ValueError, match="IBM_QUANTUM_TOKEN"):
        run_qaoa_ibm(sp, cfg, ideal_res, dry_run=False)
