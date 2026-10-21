"""Test suite for QUANTA Pydantic v2 schemas and pure-Python scorer."""
from backend.schemas import (
    Assignment,
    Timetable,
    SubProblem,
    PairWeight,
    QuantumConfig,
    QuantumResult,
    FinalDecision,
    Dataset,
    Course,
    Enrollment,
    Room,
    Slot,
)
from backend.core.scorer import score_timetable
from backend.quantum.qubo import energy, brute_force
from backend.quantum.bitorder import bits_to_assignment, assignment_to_bits


def test_schema_instantiation():
    """Verify that all core Pydantic models instantiate with correct types."""
    cfg = QuantumConfig(backend="ideal", p=1, shots=2048)
    assert cfg.p == 1
    assert cfg.shots == 2048

    decision = FinalDecision(
        cluster_id="test_cluster",
        source="baseline_fallback",
        before_score=150.0,
        after_score=150.0,
        resolved_students=0,
        hard_violations=0,
        changes=[],
        feasible_fraction=1.0,
        reason="Baseline maintained",
    )
    assert decision.hard_violations == 0


def test_bitorder_roundtrip():
    """Verify little-endian bitstring normalization helper."""
    raw_bits = "101100"
    arr = bits_to_assignment(raw_bits)
    # reversed: qubit 0 is rightmost ('0')
    assert arr == [0, 0, 1, 1, 0, 1]
    reconstructed = assignment_to_bits(arr)
    assert reconstructed == raw_bits


def test_scorer_detects_clash():
    """Verify that the independent scorer flags student exam clashes as hard violations."""
    ds = Dataset(
        courses=[
            Course(course_id="C1", name="Course 1", dept="CS"),
            Course(course_id="C2", name="Course 2", dept="CS"),
        ],
        enrollments=[
            Enrollment(student_id="S1", course_id="C1"),
            Enrollment(student_id="S1", course_id="C2"),
        ],
        rooms=[Room(room_id="R1", building="B1", capacity=100)],
        slots=[
            Slot(slot_id="SLOT1", day=0, start="09:00", end="12:00", order=0),
            Slot(slot_id="SLOT2", day=0, start="13:00", end="16:00", order=1),
        ],
    )

    # Injected clash: both courses assigned to SLOT1
    clash_tt = Timetable(
        run_id="test_clash",
        assignments=[
            Assignment(course_id="C1", slot_id="SLOT1", room_ids=["R1"]),
            Assignment(course_id="C2", slot_id="SLOT1", room_ids=["R1"]),
        ],
    )
    scored = score_timetable(ds, clash_tt)
    assert scored.hard_violations > 0


def test_fixtures_load_and_validate():
    """Verify that every fixture JSON file validates against Pydantic schemas."""
    import json
    from pathlib import Path
    from backend.schemas import BenchmarkRow

    fixtures_dir = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures"

    # 1. SubProblem
    with open(fixtures_dir / "subproblem_6.json", "r", encoding="utf-8") as f:
        sp = SubProblem.model_validate_json(f.read())
        assert sp.cluster_id == "cluster_01"
        assert len(sp.courses) == 6

    with open(fixtures_dir / "subproblem_12.json", "r", encoding="utf-8") as f:
        sp12 = SubProblem.model_validate_json(f.read())
        assert len(sp12.courses) == 12

    # 2. Timetable
    with open(fixtures_dir / "timetable.json", "r", encoding="utf-8") as f:
        tt = Timetable.model_validate_json(f.read())
        assert tt.hard_violations == 0
        assert len(tt.assignments) == 12

    # 3. QuantumResult
    with open(fixtures_dir / "quantum_result.json", "r", encoding="utf-8") as f:
        qr = QuantumResult.model_validate_json(f.read())
        assert qr.backend == "ideal"
        assert qr.approx_ratio == 1.0

    # 4. FinalDecision (Accepted & Fallback)
    with open(fixtures_dir / "decision_accepted.json", "r", encoding="utf-8") as f:
        da = FinalDecision.model_validate_json(f.read())
        assert da.source == "quantum_repaired"
        assert da.hard_violations == 0

    with open(fixtures_dir / "decision_fallback.json", "r", encoding="utf-8") as f:
        df = FinalDecision.model_validate_json(f.read())
        assert df.source == "baseline_fallback"
        assert df.hard_violations == 0

    # 5. Benchmarks
    with open(fixtures_dir / "benchmarks.json", "r", encoding="utf-8") as f:
        rows_data = json.load(f)
        rows = [BenchmarkRow.model_validate(r) for r in rows_data]
        assert len(rows) >= 5


if __name__ == "__main__":
    test_schema_instantiation()
    test_bitorder_roundtrip()
    test_scorer_detects_clash()
    test_fixtures_load_and_validate()
    print("All schema and fixture tests passed successfully!")
