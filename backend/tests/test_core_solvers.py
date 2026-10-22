"""Unit tests for CP-SAT baseline solver and independent scorer (Task A2).

Owner: Member A (Classical core + backend)
Reference: docs/CONTRACTS.md Section 4 and tasks/A_backend.md
"""
import copy
import sys
import time
from pathlib import Path

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from backend.core.baseline import solve_baseline
from backend.core.datagen import generate_dataset
from backend.core.scorer import score_timetable
from backend.schemas import (
    Assignment,
    Dataset,
    Room,
    Timetable,
)


def create_mini_dataset() -> Dataset:
    """Creates a deterministic small dataset for unit testing."""
    return generate_dataset(
        n_students=60,
        n_courses=12,
        n_rooms=4,
        n_days=2,
        slots_per_day=4,
        seed=42,
    )


def test_scorer_injected_clash():
    """Verify independent scorer flags an injected student exam clash."""
    ds = create_mini_dataset()
    tt = solve_baseline(ds, time_limit_s=5, seed=42)
    assert tt.hard_violations == 0

    # Find two courses sharing at least one student
    student_courses: dict[str, list[str]] = {}
    for e in ds.enrollments:
        student_courses.setdefault(e.student_id, []).append(e.course_id)

    clash_pair = None
    for s_id, courses in student_courses.items():
        if len(courses) >= 2:
            clash_pair = (courses[0], courses[1])
            break

    assert clash_pair is not None

    # Inject clash: force course 1 and course 2 into the exact same slot
    c1, c2 = clash_pair
    tampered_assignments = []
    target_slot = ds.slots[0].slot_id
    for a in tt.assignments:
        if a.course_id in (c1, c2):
            tampered_assignments.append(
                Assignment(course_id=a.course_id, slot_id=target_slot, room_ids=a.room_ids)
            )
        else:
            tampered_assignments.append(a)

    tampered_tt = Timetable(
        run_id="test_clash",
        assignments=tampered_assignments,
        seed=42,
    )

    scored = score_timetable(ds, tampered_tt)
    assert scored.hard_violations > 0, "Scorer failed to detect injected student clash"


def test_scorer_injected_capacity_overflow():
    """Verify independent scorer flags slot capacity overflow."""
    ds = create_mini_dataset()
    tt = solve_baseline(ds, time_limit_s=5, seed=42)
    assert tt.hard_violations == 0

    # Reduce room capacities to 1 seat to trigger an overflow
    starved_rooms = [Room(room_id=r.room_id, building=r.building, capacity=1) for r in ds.rooms]
    starved_ds = Dataset(
        courses=ds.courses,
        enrollments=ds.enrollments,
        rooms=starved_rooms,
        slots=ds.slots,
    )

    scored = score_timetable(starved_ds, tt)
    assert scored.hard_violations > 0, "Scorer failed to detect slot capacity overflow"


def test_scorer_injected_room_double_booking():
    """Verify independent scorer flags when a room is assigned multiple times in the same slot."""
    ds = create_mini_dataset()
    tt = solve_baseline(ds, time_limit_s=5, seed=42)
    assert tt.hard_violations == 0

    # Pick first two assignments and put them in the same slot with the same room
    tampered_assignments = copy.deepcopy(tt.assignments)
    same_slot = ds.slots[0].slot_id
    shared_room = ds.rooms[0].room_id

    tampered_assignments[0].slot_id = same_slot
    tampered_assignments[0].room_ids = [shared_room]
    tampered_assignments[1].slot_id = same_slot
    tampered_assignments[1].room_ids = [shared_room]

    tampered_tt = Timetable(
        run_id="test_double_booking",
        assignments=tampered_assignments,
        seed=42,
    )

    scored = score_timetable(ds, tampered_tt)
    assert scored.hard_violations > 0, "Scorer failed to detect room double-booking"


def test_scorer_injected_unassigned_course():
    """Verify independent scorer flags missing course assignments."""
    ds = create_mini_dataset()
    tt = solve_baseline(ds, time_limit_s=5, seed=42)
    assert tt.hard_violations == 0

    # Drop one assignment
    tampered_tt = Timetable(
        run_id="test_unassigned",
        assignments=tt.assignments[:-1],
        seed=42,
    )

    scored = score_timetable(ds, tampered_tt)
    assert scored.hard_violations >= 1, "Scorer failed to detect unassigned course"


def test_baseline_solver_mini():
    """Verify baseline solver produces 0 hard violations on mini dataset."""
    ds = create_mini_dataset()
    start = time.time()
    tt = solve_baseline(ds, time_limit_s=10, seed=42)
    elapsed = time.time() - start

    assert tt.hard_violations == 0, f"Baseline solver produced {tt.hard_violations} hard violations"
    assert len(tt.assignments) == len(ds.courses)
    assert tt.soft_score >= 0.0
    assert "back_to_back" in tt.penalty_breakdown
    print(f"Mini preset solved in {elapsed:.3f} s with 0 hard violations (Soft score: {tt.soft_score:.1f})")


def test_baseline_solver_demo():
    """Verify baseline solver solves demo campus dataset with 0 hard violations within time limit."""
    # Medium campus subset: 50 courses, 400 students, 12 rooms, 5 days (15 slots)
    ds = generate_dataset(
        n_students=400,
        n_courses=50,
        n_rooms=12,
        n_days=5,
        slots_per_day=3,
        seed=42,
    )

    start = time.time()
    tt = solve_baseline(ds, time_limit_s=30, seed=42)
    elapsed = time.time() - start

    assert tt.hard_violations == 0, f"Demo solver produced {tt.hard_violations} hard violations"
    assert len(tt.assignments) == 50
    assert elapsed < 30.0, f"Solve time {elapsed:.2f} s exceeded time limit"
    print(f"Demo campus subset solved in {elapsed:.3f} s with 0 hard violations (Soft score: {tt.soft_score:.1f})")


if __name__ == "__main__":
    test_scorer_injected_clash()
    test_scorer_injected_capacity_overflow()
    test_scorer_injected_room_double_booking()
    test_scorer_injected_unassigned_course()
    test_baseline_solver_mini()
    test_baseline_solver_demo()
    print("All core solver and scorer tests passed successfully!")
