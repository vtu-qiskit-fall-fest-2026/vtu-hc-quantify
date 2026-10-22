"""Unit tests for classical repair heuristic and acceptance decision gate (Task A4).

Owner: Member A (Classical core + backend)
Reference: docs/CONTRACTS.md Section 4, docs/QUBO_SPEC.md Section 10, and tasks/A_backend.md
"""
from __future__ import annotations

import random
from pathlib import Path

import pytest

from backend.core.baseline import solve_baseline
from backend.core.datagen import generate_dataset
from backend.core.extractor import extract_clusters
from backend.core.repair import decide, decode, repair, validate
from backend.schemas import (
    BitstringCount,
    FinalDecision,
    QuantumResult,
)


@pytest.fixture
def mini_system():
    ds = generate_dataset(
        n_students=60,
        n_courses=12,
        n_rooms=4,
        n_days=2,
        slots_per_day=4,
        seed=42,
    )
    tt = solve_baseline(ds, time_limit_s=10, seed=42)
    assert tt.hard_violations == 0
    clusters = extract_clusters(ds, tt, max_size=6, top_k=1)
    assert len(clusters) >= 1
    sp = clusters[0]
    return ds, tt, sp


def test_decode_bitstring(mini_system):
    """Verify bitstring decoding correctly maps '0' to candidate A and '1' to candidate B."""
    _, _, sp = mini_system
    n = len(sp.courses)

    # All zeros
    zeros_map = decode(sp, "0" * n)
    for c in sp.courses:
        assert zeros_map[c] == sp.candidates[c][0]

    # All ones
    ones_map = decode(sp, "1" * n)
    for c in sp.courses:
        assert ones_map[c] == sp.candidates[c][1]

    # Alternating
    alt_bits = "".join("1" if i % 2 == 1 else "0" for i in range(n))
    alt_map = decode(sp, alt_bits)
    for i, c in enumerate(sp.courses):
        expected = sp.candidates[c][1] if i % 2 == 1 else sp.candidates[c][0]
        assert alt_map[c] == expected


def test_validate_clean_baseline(mini_system):
    """Verify that applying unchanged baseline candidate A produces 0 violations."""
    ds, tt, sp = mini_system
    baseline_changes = {c: sp.candidates[c][0] for c in sp.courses}
    violations = validate(ds, tt, baseline_changes)
    assert violations == []


def test_forged_all_ones_repaired_or_rejected(mini_system):
    """Verify a forged all-ones bitstring creating capacity overflow/clashes is safely repaired or rejected."""
    ds, tt, sp = mini_system
    all_ones_bits = "1" * len(sp.courses)

    repaired = repair(ds, tt, sp, all_ones_bits)
    if repaired is not None:
        # If repaired, it must be strictly feasible
        violations = validate(ds, tt, repaired)
        assert violations == [], f"Repaired timetable had unexpected violations: {violations}"
    else:
        # Safely rejected as infeasible
        assert repaired is None


def test_forged_infeasible_quantum_result_yields_fallback(mini_system):
    """Verify that a QuantumResult with only infeasible bitstrings falls back to certified baseline."""
    ds, tt, sp = mini_system
    # Intentionally create conflicting bitstring items
    fake_top = [
        BitstringCount(bits="1" * len(sp.courses), count=2000, energy=9999.0),
        BitstringCount(bits="1" * len(sp.courses), count=1000, energy=9998.0),
    ]
    qr = QuantumResult(
        backend="ideal",
        backend_detail="fake",
        p=1,
        shots=3000,
        params=[0.1, 0.2],
        energy_history=[9999.0],
        top_bitstrings=fake_top,
        best_sampled_energy=9998.0,
        depth=10,
        two_qubit_gates=10,
        transpile_seconds=0.01,
        run_seconds=0.01,
    )

    decision = decide(ds, tt, sp, qr)
    assert decision.hard_violations == 0
    # Must fallback or if repair produced a candidate, soft score cannot worsen
    if decision.source == "baseline_fallback":
        assert decision.after_score == decision.before_score
        assert decision.changes == []
    else:
        assert decision.after_score < decision.before_score


def test_decide_never_returns_hard_violations_property_test(mini_system):
    """Property test: evaluate 200 random bitstrings; decide must NEVER return hard_violations > 0."""
    ds, tt, sp = mini_system
    n = len(sp.courses)
    rng = random.Random(1337)

    # Generate 200 random bitstrings
    random_bitstrings: list[BitstringCount] = []
    for _ in range(200):
        bits = "".join(rng.choice(["0", "1"]) for _ in range(n))
        count = rng.randint(10, 500)
        random_bitstrings.append(BitstringCount(bits=bits, count=count, energy=100.0))

    # Sort descending by count to mirror top_bitstrings contract
    random_bitstrings.sort(key=lambda item: item.count, reverse=True)

    qr = QuantumResult(
        backend="ideal",
        backend_detail="property_test",
        p=1,
        shots=4096,
        params=[0.5, 0.5],
        energy_history=[100.0],
        top_bitstrings=random_bitstrings[:32],
        best_sampled_energy=100.0,
        depth=10,
        two_qubit_gates=10,
        transpile_seconds=0.05,
        run_seconds=0.1,
    )

    decision = decide(ds, tt, sp, qr)

    # Core invariant: hard violations MUST be 0
    assert decision.hard_violations == 0

    if decision.source == "quantum_repaired":
        assert decision.after_score < decision.before_score
        assert len(decision.changes) > 0
        assert decision.resolved_students > 0
    else:
        assert decision.source == "baseline_fallback"
        assert decision.after_score == decision.before_score
        assert decision.changes == []


def test_fixture_decision_files_semantic_conformance():
    """Verify that fixture files decision_accepted.json and decision_fallback.json validate against schema and semantics."""
    fixtures_dir = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures"

    # Accepted fixture
    with open(fixtures_dir / "decision_accepted.json", "r", encoding="utf-8") as f:
        da = FinalDecision.model_validate_json(f.read())
        assert da.source == "quantum_repaired"
        assert da.hard_violations == 0
        assert da.after_score < da.before_score
        assert len(da.changes) > 0
        assert da.feasible_fraction > 0.0

    # Fallback fixture
    with open(fixtures_dir / "decision_fallback.json", "r", encoding="utf-8") as f:
        df = FinalDecision.model_validate_json(f.read())
        assert df.source == "baseline_fallback"
        assert df.hard_violations == 0
        assert df.after_score == df.before_score
        assert len(df.changes) == 0
