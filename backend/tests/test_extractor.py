"""Unit tests for bottleneck cluster extractor (Task A3).

Owner: Member A (Classical core + backend)
Reference: docs/CONTRACTS.md, docs/QUBO_SPEC.md, and tasks/A_backend.md
"""
from __future__ import annotations

from pathlib import Path

import pytest

from backend.core.baseline import solve_baseline
from backend.core.datagen import generate_dataset
from backend.core.extractor import extract_clusters, get_slot_relation
from backend.quantum.qubo import energy
from backend.schemas import QuantumConfig, SubProblem


def local_qubo_energy_zero(sp: SubProblem) -> float:
    """Local independent re-implementation of docs/QUBO_SPEC.md Section 3 energy at x = 0."""
    cost = 0.0
    pen_table = sp.penalty_table
    slot_meta = sp.slot_meta

    # 1. Pairwise cluster student conflict penalties
    for pw in sp.pair_weights:
        s_a = sp.candidates[pw.a][0]
        s_b = sp.candidates[pw.b][0]
        rel = get_slot_relation(slot_meta, s_a, s_b)
        cost += pw.shared_students * pen_table.get(rel, 0.0)

    # 2. Fixed external neighbor penalties
    for fn in sp.fixed_neighbors:
        s_c = sp.candidates[fn.course_id][0]
        rel = get_slot_relation(slot_meta, s_c, fn.slot_id)
        cost += fn.shared_students * pen_table.get(rel, 0.0)

    return float(cost)


@pytest.fixture
def mini_dataset_and_tt():
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
    return ds, tt


def test_extractor_size_bounds(mini_dataset_and_tt):
    """Verify cluster sizes satisfy the contract: 4 <= len(courses) <= 14."""
    ds, tt = mini_dataset_and_tt
    clusters = extract_clusters(ds, tt, max_size=10, top_k=3)
    for sp in clusters:
        assert 4 <= len(sp.courses) <= 14
        assert len(sp.candidates) == len(sp.courses)
        assert len(sp.sizes) == len(sp.courses)


def test_candidates_distinct_slots(mini_dataset_and_tt):
    """Verify candidate slots A and B are strictly distinct for every cluster course."""
    ds, tt = mini_dataset_and_tt
    clusters = extract_clusters(ds, tt, max_size=10, top_k=3)
    for sp in clusters:
        for c, (slot_a, slot_b) in sp.candidates.items():
            assert slot_a != slot_b, f"Course {c} has duplicate candidate slots: {slot_a} == {slot_b}"


def test_candidate_b_no_hard_clash_with_fixed_neighbors(mini_dataset_and_tt):
    """Verify that placing any cluster course in its candidate slot B never causes a student clash with external fixed courses."""
    ds, tt = mini_dataset_and_tt
    clusters = extract_clusters(ds, tt, max_size=10, top_k=3)

    course_to_slot = {a.course_id: a.slot_id for a in tt.assignments}

    # Student to courses mapping
    student_courses: dict[str, set[str]] = {}
    for e in ds.enrollments:
        student_courses.setdefault(e.student_id, set()).add(e.course_id)

    # Precompute course conflict graph
    course_conflicts: dict[str, set[str]] = {}
    for courses in student_courses.values():
        for c1 in courses:
            for c2 in courses:
                if c1 != c2:
                    course_conflicts.setdefault(c1, set()).add(c2)

    for sp in clusters:
        cluster_courses_set = set(sp.courses)
        for c, (_, slot_b) in sp.candidates.items():
            # External conflicting neighbors
            conflicting_ext = course_conflicts.get(c, set()) - cluster_courses_set
            for ext in conflicting_ext:
                ext_slot = course_to_slot[ext]
                assert slot_b != ext_slot, (
                    f"Candidate slot B ({slot_b}) for {c} clashes with external fixed neighbor {ext} at {ext_slot}"
                )


def test_extractor_determinism(mini_dataset_and_tt):
    """Verify identical cluster outputs on identical inputs."""
    ds, tt = mini_dataset_and_tt
    clusters_1 = extract_clusters(ds, tt, max_size=8, top_k=3)
    clusters_2 = extract_clusters(ds, tt, max_size=8, top_k=3)

    assert len(clusters_1) == len(clusters_2)
    for sp1, sp2 in zip(clusters_1, clusters_2):
        assert sp1.cluster_id == sp2.cluster_id
        assert sp1.courses == sp2.courses
        assert sp1.candidates == sp2.candidates
        assert sp1.baseline_cluster_cost == sp2.baseline_cluster_cost


def test_baseline_cluster_cost_equals_qubo_energy_zero(mini_dataset_and_tt):
    """Verify baseline_cluster_cost matches both independent formula and backend.quantum.qubo.energy at x = 0."""
    ds, tt = mini_dataset_and_tt
    clusters = extract_clusters(ds, tt, max_size=10, top_k=3)
    cfg = QuantumConfig(backend="ideal", lambda_cap=0.0)

    for sp in clusters:
        # 1. Compare against local mirror of QUBO_SPEC
        local_e = local_qubo_energy_zero(sp)
        assert abs(sp.baseline_cluster_cost - local_e) < 1e-9, (
            f"Local energy mismatch: {sp.baseline_cluster_cost} vs {local_e}"
        )

        # 2. Compare against Quantum module's energy() evaluation
        qubo_e = energy(sp, cfg, [0] * len(sp.courses))
        assert abs(sp.baseline_cluster_cost - qubo_e) < 1e-9, (
            f"Quantum module energy mismatch: {sp.baseline_cluster_cost} vs {qubo_e}"
        )


def test_fixture_subproblem_12_validation():
    """Verify data/fixtures/subproblem_12.json matches the contract and QUBO energy parity."""
    fixture_path = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "subproblem_12.json"
    assert fixture_path.exists(), "data/fixtures/subproblem_12.json must exist"

    with open(fixture_path, "r", encoding="utf-8") as f:
        sp = SubProblem.model_validate_json(f.read())

    assert len(sp.courses) == 12
    assert 4 <= len(sp.courses) <= 14
    for s_a, s_b in sp.candidates.values():
        assert s_a != s_b

    cfg = QuantumConfig(backend="ideal", lambda_cap=0.0)
    qubo_e = energy(sp, cfg, [0] * len(sp.courses))
    assert abs(sp.baseline_cluster_cost - qubo_e) < 1e-9
