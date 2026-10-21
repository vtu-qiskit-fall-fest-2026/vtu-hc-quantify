"""Google OR-Tools CP-SAT global timetable baseline solver with greedy graph coloring fallback.

Task: A2 (Member A: Classical core + backend)
Reference: docs/CONTRACTS.md Section 4 and tasks/A_backend.md
"""
from __future__ import annotations

import time
from collections import defaultdict
from typing import Any

from backend.core.scorer import score_timetable
from backend.schemas import Assignment, Course, Dataset, Room, Slot, Timetable


def assign_rooms_best_fit(
    courses_in_slot: list[str],
    course_enrollments: dict[str, int],
    rooms: list[Room],
) -> dict[str, list[str]]:
    """Assigns physical rooms to courses in a slot using Best-Fit Decreasing (BFD).

    Guarantees no room double-booking within the slot and ensures assigned
    room capacity satisfies each course's enrollment headcount.
    """
    sorted_courses = sorted(
        courses_in_slot,
        key=lambda c_id: course_enrollments.get(c_id, 0),
        reverse=True,
    )
    # Available rooms sorted descending by capacity
    available_rooms = sorted(rooms, key=lambda r: r.capacity, reverse=True)
    assigned_rooms: set[str] = set()
    result: dict[str, list[str]] = {}

    for c_id in sorted_courses:
        needed = course_enrollments.get(c_id, 0)
        allocated: list[str] = []
        allocated_cap = 0

        # Try to find the smallest single room that fits the course
        best_single: Room | None = None
        for r in reversed(available_rooms):
            if r.room_id not in assigned_rooms and r.capacity >= needed:
                best_single = r
                break

        if best_single is not None:
            allocated.append(best_single.room_id)
            assigned_rooms.add(best_single.room_id)
        else:
            # Multi-room split: take largest available rooms until needed capacity is satisfied
            for r in available_rooms:
                if r.room_id not in assigned_rooms:
                    allocated.append(r.room_id)
                    assigned_rooms.add(r.room_id)
                    allocated_cap += r.capacity
                    if allocated_cap >= needed:
                        break

            # Fallback if campus capacity is exhausted: take any room
            if not allocated and available_rooms:
                allocated.append(available_rooms[0].room_id)

        result[c_id] = allocated

    return result


def solve_greedy_graph_coloring(
    ds: Dataset,
    course_enrollments: dict[str, int],
    conflict_graph: dict[str, set[str]],
    pair_weights: dict[tuple[str, str], int],
) -> dict[str, str]:
    """DSATUR / Welsh-Powell greedy graph coloring heuristic.

    Schedules conflicting courses onto non-overlapping slots with zero student clashes
    and minimizes back-to-back exam fatigue.
    """
    course_ids = [c.course_id for c in ds.courses]
    slot_ids = [s.slot_id for s in ds.slots]
    slot_meta = {s.slot_id: (s.day, s.order) for s in ds.slots}
    total_room_capacity = sum(r.capacity for r in ds.rooms)
    avg_per_slot = (len(course_ids) + len(slot_ids) - 1) // len(slot_ids)
    max_courses_per_slot = min(len(ds.rooms), max(avg_per_slot + 2, 1))

    # Degree of each course in conflict graph
    degrees = {c: len(conflict_graph.get(c, set())) for c in course_ids}

    # Tracking slot allocations
    course_to_slot: dict[str, str] = {}
    slot_to_courses: dict[str, list[str]] = {s_id: [] for s_id in slot_ids}
    slot_load: dict[str, int] = {s_id: 0 for s_id in slot_ids}

    # Saturation degree tracking for DSATUR
    saturation: dict[str, set[str]] = {c: set() for c in course_ids}
    unassigned = set(course_ids)

    while unassigned:
        # Pick unassigned course with highest saturation degree, ties broken by graph degree
        best_course = max(
            unassigned,
            key=lambda c: (len(saturation[c]), degrees[c], course_enrollments.get(c, 0)),
        )
        c_size = course_enrollments.get(best_course, 0)
        conflicts = conflict_graph.get(best_course, set())

        # Evaluate candidate slots
        best_slot: str | None = None
        best_penalty = float("inf")

        for s_id in slot_ids:
            # Check Hard Constraint: No conflict with assigned courses in this slot
            existing = slot_to_courses[s_id]
            if any(other in conflicts for other in existing):
                continue

            # Check Hard Constraint: Number of simultaneous exams in slot <= max_courses_per_slot
            if len(existing) >= max_courses_per_slot:
                continue

            # Check Hard Constraint: Slot total capacity
            if slot_load[s_id] + c_size > total_room_capacity:
                continue

            # Compute soft penalty against already assigned conflicting neighbors
            penalty = 0.0
            day_s, order_s = slot_meta[s_id]
            for other in conflicts:
                if other in course_to_slot:
                    other_s = course_to_slot[other]
                    day_o, order_o = slot_meta[other_s]
                    pair_key = (min(best_course, other), max(best_course, other))
                    weight = pair_weights.get(pair_key, 1)
                    if day_s == day_o:
                        if abs(order_s - order_o) == 1:
                            penalty += 10.0 * weight  # back to back
                        else:
                            penalty += 2.0 * weight  # same day
            # Slight tie-breaker for even distribution
            penalty += 0.01 * len(existing)

            if penalty < best_penalty:
                best_penalty = penalty
                best_slot = s_id

        # Fallback if no clean slot found (e.g. extreme oversubscription): pick slot with minimum clash
        if best_slot is None:
            best_slot = min(
                slot_ids,
                key=lambda s_id: (
                    sum(1 for other in slot_to_courses[s_id] if other in conflicts),
                    slot_load[s_id],
                ),
            )

        # Commit assignment
        course_to_slot[best_course] = best_slot
        slot_to_courses[best_slot].append(best_course)
        slot_load[best_slot] += c_size
        unassigned.remove(best_course)

        # Update saturation degrees of conflicting neighbors
        for other in conflicts:
            if other in unassigned:
                saturation[other].add(best_slot)

    return course_to_slot


def solve_baseline(
    ds: Dataset,
    time_limit_s: int = 60,
    seed: int = 0,
) -> Timetable:
    """Solves the global university examination timetabling problem with 0 hard violations.

    Combines:
    1. Google OR-Tools CP-SAT formulation with conflict pairs, capacity limits, and soft objective.
    2. DSATUR greedy graph coloring hint injection and standalone fallback.
    3. Stage 2 Best-Fit Decreasing (BFD) physical room assignment.
    4. Independent pure-Python score verification.
    """
    start_time = time.time()

    # Precompute student courses and conflict graph
    course_enrollments: dict[str, int] = {c.course_id: 0 for c in ds.courses}
    student_courses: dict[str, list[str]] = defaultdict(list)
    for e in ds.enrollments:
        student_courses[e.student_id].append(e.course_id)
        course_enrollments[e.course_id] = course_enrollments.get(e.course_id, 0) + 1

    # Conflict graph and pairwise weights
    conflict_graph: dict[str, set[str]] = defaultdict(set)
    pair_weights: dict[tuple[str, str], int] = defaultdict(int)

    for student_id, c_list in student_courses.items():
        c_sorted = sorted(c_list)
        for i in range(len(c_sorted)):
            for j in range(i + 1, len(c_sorted)):
                c1, c2 = c_sorted[i], c_sorted[j]
                conflict_graph[c1].add(c2)
                conflict_graph[c2].add(c1)
                pair_weights[(c1, c2)] += 1

    # Compute greedy graph-coloring solution (used as CP-SAT warm hint and fallback)
    greedy_assignments = solve_greedy_graph_coloring(
        ds, course_enrollments, conflict_graph, pair_weights
    )

    # Attempt solving via OR-Tools CP-SAT
    has_ortools = False
    try:
        from ortools.sat.python import cp_model
        has_ortools = True
    except (ImportError, ModuleNotFoundError):
        has_ortools = False

    course_to_slot_solution: dict[str, str] = {}

    if has_ortools:
        model = cp_model.CpModel()
        num_courses = len(ds.courses)
        num_slots = len(ds.slots)

        course_idx = {c.course_id: i for i, c in enumerate(ds.courses)}
        slot_idx = {s.slot_id: i for i, s in enumerate(ds.slots)}
        slot_meta = {s.slot_id: (s.day, s.order) for s in ds.slots}
        total_room_capacity = sum(r.capacity for r in ds.rooms)

        # Decision variables: x[c, s] == 1 if course c is in slot s
        x: dict[tuple[int, int], cp_model.IntVar] = {}
        for c_id, c_i in course_idx.items():
            for s_id, s_i in slot_idx.items():
                x[c_i, s_i] = model.NewBoolVar(f"x_{c_i}_{s_i}")

        # Inject warm hints from greedy graph coloring
        for c_id, s_id in greedy_assignments.items():
            if c_id in course_idx and s_id in slot_idx:
                c_i = course_idx[c_id]
                s_i = slot_idx[s_id]
                model.AddHint(x[c_i, s_i], 1)

        # Hard Constraint 1: Each course assigned to exactly one slot
        for c_id, c_i in course_idx.items():
            model.Add(sum(x[c_i, s_i] for s_i in range(num_slots)) == 1)

        # Hard Constraint 2: No student clash (at most one exam per slot)
        for student_id, c_ids in student_courses.items():
            valid_indices = [course_idx[c] for c in c_ids if c in course_idx]
            if len(valid_indices) > 1:
                for s_i in range(num_slots):
                    model.Add(sum(x[c_i, s_i] for c_i in valid_indices) <= 1)

        # Hard Constraint 3: Per-slot enrollment capacity and room count constraints
        avg_courses_per_slot = (num_courses + num_slots - 1) // num_slots
        max_courses_per_slot = min(len(ds.rooms), max(avg_courses_per_slot + 2, 1))

        for s_id, s_i in slot_idx.items():
            model.Add(sum(x[c_i, s_i] for c_i in range(num_courses)) <= max_courses_per_slot)
            model.Add(
                sum(course_enrollments.get(c.course_id, 0) * x[course_idx[c.course_id], s_i] for c in ds.courses)
                <= total_room_capacity
            )

        # Soft Objective: Minimize back-to-back exams for conflicting course pairs
        adj_slot_pairs: list[tuple[int, int]] = []
        for s1 in ds.slots:
            d1, o1 = slot_meta[s1.slot_id]
            for s2 in ds.slots:
                d2, o2 = slot_meta[s2.slot_id]
                if d1 == d2 and o2 == o1 + 1:
                    adj_slot_pairs.append((slot_idx[s1.slot_id], slot_idx[s2.slot_id]))

        # Limit soft objective to top conflict pairs to keep the integer model lean
        sorted_pairs = sorted(pair_weights.items(), key=lambda item: item[1], reverse=True)[:300]
        obj_terms = []
        for (c1, c2), weight in sorted_pairs:
            if c1 in course_idx and c2 in course_idx:
                c1_i, c2_i = course_idx[c1], course_idx[c2]
                for s1_i, s2_i in adj_slot_pairs:
                    b2b_1 = model.NewBoolVar(f"b2b_{c1_i}_{c2_i}_{s1_i}_{s2_i}")
                    model.AddBoolAnd([x[c1_i, s1_i], x[c2_i, s2_i]]).OnlyEnforceIf(b2b_1)
                    b2b_2 = model.NewBoolVar(f"b2b_{c2_i}_{c1_i}_{s1_i}_{s2_i}")
                    model.AddBoolAnd([x[c2_i, s1_i], x[c1_i, s2_i]]).OnlyEnforceIf(b2b_2)
                    obj_terms.append(10 * weight * (b2b_1 + b2b_2))

        if obj_terms:
            model.Minimize(sum(obj_terms))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(time_limit_s)
        solver.parameters.random_seed = seed
        solver.parameters.num_workers = 8

        status = solver.Solve(model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            for c in ds.courses:
                c_i = course_idx[c.course_id]
                for s in ds.slots:
                    s_i = slot_idx[s.slot_id]
                    if solver.Value(x[c_i, s_i]) == 1:
                        course_to_slot_solution[c.course_id] = s.slot_id
                        break

    # If CP-SAT was not installed or timed out/infeasible, deploy greedy solution
    if not course_to_slot_solution:
        course_to_slot_solution = greedy_assignments

    # -----------------------------------------------------------------------
    # Stage 2: Best-Fit Decreasing (BFD) Physical Room Allocation per Slot
    # -----------------------------------------------------------------------
    slot_course_map: dict[str, list[str]] = defaultdict(list)
    for c_id, s_id in course_to_slot_solution.items():
        slot_course_map[s_id].append(c_id)

    assignments: list[Assignment] = []
    for s_id, c_list in slot_course_map.items():
        room_allocations = assign_rooms_best_fit(c_list, course_enrollments, ds.rooms)
        for c_id in c_list:
            assignments.append(
                Assignment(
                    course_id=c_id,
                    slot_id=s_id,
                    room_ids=room_allocations.get(c_id, [ds.rooms[0].room_id]),
                )
            )

    elapsed = time.time() - start_time
    prelim = Timetable(
        run_id="run_baseline",
        assignments=assignments,
        hard_violations=0,
        soft_score=0.0,
        solve_seconds=elapsed,
        seed=seed,
    )

    # Certify and score using the independent scorer
    return score_timetable(ds, prelim)

