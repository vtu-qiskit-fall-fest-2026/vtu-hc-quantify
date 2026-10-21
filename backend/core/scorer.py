"""Independent pure-Python timetable validator and soft penalty scorer.

Task: A2 (Member A: Classical core + backend)
Reference: docs/CONTRACTS.md Section 4 and tasks/A_backend.md
Must NOT import ortools. Authority on hard constraint verification and
soft objective penalty calculations.
"""
from __future__ import annotations

from dataclasses import dataclass

from backend.schemas import Assignment, Dataset, Timetable


@dataclass(frozen=True)
class ScoreWeights:
    back_to_back: float = 10.0
    three_in_day: float = 3.0
    two_in_day: float = 1.0


def score_timetable(
    ds: Dataset,
    tt: Timetable,
    weights: ScoreWeights = ScoreWeights(),
) -> Timetable:
    """Audits hard violations and computes soft objective penalties.

    Hard Violations audited (must be 0 for valid timetable):
    1. Unassigned courses: every course in ds.courses must be scheduled.
    2. Multiple assignments: each course assigned to at most one slot.
    3. Student clashes: no student may have two exams in the same slot.
    4. Room double-booking: no room may be used by multiple courses in the same slot.
    5. Slot capacity overflow: total enrolled students in a slot must not exceed total room capacity.

    Soft Score penalties:
    - 10.0 * back_to_back: consecutive exams in adjacent slots on the same day.
    - 3.0 * three_in_day: students having 3 or more exams on a single day.
    - 1.0 * two_in_day: student-days having exactly 2 exams.
    """
    hard_violations = 0
    slot_map = {s.slot_id: s for s in ds.slots}
    room_cap = {r.room_id: r.capacity for r in ds.rooms}
    course_ids_set = {c.course_id for c in ds.courses}

    # Course enrollments
    course_enrollment: dict[str, int] = {}
    student_courses: dict[str, set[str]] = {}
    for e in ds.enrollments:
        student_courses.setdefault(e.student_id, set()).add(e.course_id)
        course_enrollment[e.course_id] = course_enrollment.get(e.course_id, 0) + 1

    course_to_slot: dict[str, str] = {}
    slot_to_courses: dict[str, list[str]] = {}
    slot_room_usage: dict[str, set[str]] = {}
    assigned_courses: set[str] = set()

    for a in tt.assignments:
        # Check course double assignment
        if a.course_id in assigned_courses:
            hard_violations += 1
        assigned_courses.add(a.course_id)
        course_to_slot[a.course_id] = a.slot_id
        slot_to_courses.setdefault(a.slot_id, []).append(a.course_id)

        # Check room double-booking within slot
        for r in a.room_ids:
            if r in slot_room_usage.setdefault(a.slot_id, set()):
                hard_violations += 1
            slot_room_usage[a.slot_id].add(r)

        # Check course-specific room capacity coverage
        assigned_room_capacity = sum(room_cap.get(r, 0) for r in a.room_ids)
        course_size = course_enrollment.get(a.course_id, 0)
        if course_size > assigned_room_capacity:
            hard_violations += 1

    # Check unassigned courses
    unassigned_count = len(course_ids_set - assigned_courses)
    hard_violations += unassigned_count

    # Check student exam clashes (at most one exam per slot)
    for student_id, courses in student_courses.items():
        slots_attended = [course_to_slot[c] for c in courses if c in course_to_slot]
        if len(slots_attended) != len(set(slots_attended)):
            hard_violations += len(slots_attended) - len(set(slots_attended))

    # Check slot capacity overflow (aggregate slot level)
    for slot_id, courses in slot_to_courses.items():
        total_enrolled = sum(course_enrollment.get(c, 0) for c in courses)
        assigned_rooms = slot_room_usage.get(slot_id, set())
        total_capacity = sum(room_cap.get(r, 0) for r in assigned_rooms)
        if total_enrolled > total_capacity:
            hard_violations += 1

    # Compute soft constraints: student daily exam distributions
    back_to_back = 0
    three_in_day = 0
    two_in_day = 0

    for student_id, courses in student_courses.items():
        student_slots = [
            slot_map[course_to_slot[c]]
            for c in courses
            if c in course_to_slot and course_to_slot[c] in slot_map
        ]

        # Group by day
        day_slots: dict[int, list[int]] = {}
        for s in student_slots:
            day_slots.setdefault(s.day, []).append(s.order)

        student_had_three = False
        for day, orders in day_slots.items():
            count = len(orders)
            if count >= 3:
                student_had_three = True
            elif count == 2:
                two_in_day += 1

            # Check consecutive slots on the same day
            sorted_orders = sorted(orders)
            for i in range(len(sorted_orders) - 1):
                if sorted_orders[i + 1] - sorted_orders[i] == 1:
                    back_to_back += 1

        if student_had_three:
            three_in_day += 1

    soft_score = (
        weights.back_to_back * back_to_back
        + weights.three_in_day * three_in_day
        + weights.two_in_day * two_in_day
    )

    return Timetable(
        run_id=tt.run_id,
        assignments=tt.assignments,
        hard_violations=hard_violations,
        soft_score=float(soft_score),
        penalty_breakdown={
            "back_to_back": back_to_back,
            "three_in_day": three_in_day,
            "two_in_day": two_in_day,
        },
        solve_seconds=tt.solve_seconds,
        seed=tt.seed,
    )

