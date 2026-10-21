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


if __name__ == "__main__":
    test_schema_instantiation()
    test_bitorder_roundtrip()
    test_scorer_detects_clash()
    print("All schema tests passed successfully!")
