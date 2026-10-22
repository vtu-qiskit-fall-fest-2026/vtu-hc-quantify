"""Deterministic classical repair heuristic and acceptance decision gate.

Task: A4 (Member A: Classical core + backend)
Reference: docs/CONTRACTS.md Section 4, docs/QUBO_SPEC.md Section 10, and tasks/A_backend.md
"""
from __future__ import annotations

from collections import defaultdict

from ortools.sat.python import cp_model

from backend.core.baseline import assign_rooms_best_fit
from backend.core.extractor import get_slot_relation
from backend.core.scorer import score_timetable
from backend.schemas import (
    Assignment,
    Dataset,
    FinalDecision,
    QuantumResult,
    Room,
    SubProblem,
    Timetable,
)


def decode(sp: SubProblem, bits: str) -> dict[str, str]:
    """Decodes normalized bitstring into course -> slot mapping.

    bits[i] corresponds to course sp.courses[i].
    bit '0' -> candidate Slot A (current baseline)
    bit '1' -> candidate Slot B (alternative)
    """
    changes: dict[str, str] = {}
    for i, c in enumerate(sp.courses):
        slot_a, slot_b = sp.candidates[c]
        if i < len(bits) and bits[i] == "1":
            changes[c] = slot_b
        else:
            changes[c] = slot_a
    return changes


def solve_room_allocation_cpsat(
    courses_in_slot: list[str],
    course_enrollments: dict[str, int],
    rooms: list[Room],
    time_limit_s: float = 2.0,
) -> dict[str, list[str]] | None:
    """Solves room assignment feasibility for a single slot using CP-SAT integer programming.

    Returns mapping of course_id -> list of room_ids, or None if infeasible.
    """
    if not courses_in_slot:
        return {}

    total_needed = sum(course_enrollments.get(c, 0) for c in courses_in_slot)
    total_avail = sum(r.capacity for r in rooms)
    if total_needed > total_avail:
        return None

    model = cp_model.CpModel()
    y: dict[tuple[str, str], cp_model.IntVar] = {}

    for c in courses_in_slot:
        for r in rooms:
            y[(c, r.room_id)] = model.NewBoolVar(f"room_{c}_{r.room_id}")

    # Constraint 1: Each room is used at most once in this slot (no double-booking)
    for r in rooms:
        model.Add(sum(y[(c, r.room_id)] for c in courses_in_slot) <= 1)

    # Constraint 2: Total capacity of rooms assigned to each course meets its enrollment
    for c in courses_in_slot:
        needed = course_enrollments.get(c, 0)
        model.Add(
            sum(r.capacity * y[(c, r.room_id)] for r in rooms) >= needed
        )
        # Each course must have at least one room
        model.Add(sum(y[(c, r.room_id)] for r in rooms) >= 1)

    # Objective: Minimize total allocated capacity to pack rooms tightly
    obj_terms = [
        r.capacity * y[(c, r.room_id)]
        for c in courses_in_slot
        for r in rooms
    ]
    model.Minimize(sum(obj_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_s
    solver.parameters.num_workers = 1
    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        allocations: dict[str, list[str]] = defaultdict(list)
        for c in courses_in_slot:
            for r in rooms:
                if solver.Value(y[(c, r.room_id)]) == 1:
                    allocations[c].append(r.room_id)
        return dict(allocations)

    return None


def validate(ds: Dataset, tt: Timetable, changes: dict[str, str]) -> list[str]:
    """Verifies that applying candidate slot changes produces 0 hard violations.

    Performs:
    1. Student exam clash detection (no student sitting 2 exams in the same slot).
    2. Total slot capacity compliance (slot enrollment <= total room capacity).
    3. CP-SAT room allocation feasibility for changed slots (exams fit in rooms without double-booking).
    4. Full independent audit using score_timetable.
    Empty list return means strictly feasible.
    """
    violations: list[str] = []

    course_enrollments = {c.course_id: 0 for c in ds.courses}
    student_courses: dict[str, set[str]] = defaultdict(set)
    for e in ds.enrollments:
        course_enrollments[e.course_id] = course_enrollments.get(e.course_id, 0) + 1
        student_courses[e.student_id].add(e.course_id)

    orig_slot_map = {a.course_id: a.slot_id for a in tt.assignments}
    new_slot_map = dict(orig_slot_map)
    for c, s in changes.items():
        new_slot_map[c] = s

    # 1. Student exam clashes
    for s_id, courses in student_courses.items():
        slots_seen: dict[str, str] = {}
        for c in courses:
            slot = new_slot_map.get(c)
            if not slot:
                continue
            if slot in slots_seen:
                violations.append(
                    f"Student clash: student {s_id} has simultaneous exams in slot {slot} "
                    f"({slots_seen[slot]} and {c})"
                )
            else:
                slots_seen[slot] = c

    # 2. Slot total enrollment vs campus room capacity
    total_room_capacity = sum(r.capacity for r in ds.rooms)
    slot_loads: dict[str, int] = defaultdict(int)
    slot_courses: dict[str, list[str]] = defaultdict(list)
    for c, s in new_slot_map.items():
        slot_loads[s] += course_enrollments.get(c, 0)
        slot_courses[s].append(c)

    for s, load in slot_loads.items():
        if load > total_room_capacity:
            violations.append(
                f"Slot capacity overflow: slot {s} enrollment ({load}) "
                f"exceeds total room capacity ({total_room_capacity})"
            )

    # 3. CP-SAT room allocation feasibility for all changed slots
    changed_slots = set()
    for c, new_s in new_slot_map.items():
        orig_s = orig_slot_map.get(c)
        if new_s != orig_s:
            if orig_s:
                changed_slots.add(orig_s)
            changed_slots.add(new_s)

    for s in changed_slots:
        c_list = slot_courses.get(s, [])
        alloc = solve_room_allocation_cpsat(c_list, course_enrollments, ds.rooms)
        if alloc is None:
            violations.append(
                f"Room allocation infeasible in slot {s}: courses {c_list} cannot be accommodated "
                f"in campus rooms without double-booking"
            )

    # 4. If preliminary checks pass, build proposed timetable and run independent scorer
    if not violations:
        new_assignments: list[Assignment] = []
        for a in tt.assignments:
            target_slot = new_slot_map[a.course_id]
            if target_slot in changed_slots:
                c_list = slot_courses[target_slot]
                alloc = solve_room_allocation_cpsat(c_list, course_enrollments, ds.rooms)
                if not alloc:
                    alloc = assign_rooms_best_fit(c_list, course_enrollments, ds.rooms)
                room_ids = alloc.get(a.course_id, a.room_ids)
            else:
                room_ids = a.room_ids

            new_assignments.append(
                Assignment(
                    course_id=a.course_id,
                    slot_id=target_slot,
                    room_ids=room_ids,
                )
            )

        audited = score_timetable(
            ds,
            Timetable(
                run_id="validate_audit",
                assignments=new_assignments,
                seed=tt.seed,
            ),
        )
        if audited.hard_violations > 0:
            violations.append(
                f"Independent scorer flagged {audited.hard_violations} hard violation(s)"
            )

    return violations


def compute_qubo_energy(sp: SubProblem, x: list[int]) -> float:
    """Computes exact classical QUBO energy for binary vector x."""
    pen_table = sp.penalty_table
    slot_meta = sp.slot_meta

    course_slots: dict[str, str] = {}
    for i, c in enumerate(sp.courses):
        val = x[i] if i < len(x) else 0
        cand_a, cand_b = sp.candidates[c]
        course_slots[c] = cand_b if val == 1 else cand_a

    cost = 0.0
    for pw in sp.pair_weights:
        s_c = course_slots.get(pw.a)
        s_d = course_slots.get(pw.b)
        if s_c and s_d:
            rel = get_slot_relation(slot_meta, s_c, s_d)
            cost += pw.shared_students * pen_table.get(rel, 0.0)

    for fn in sp.fixed_neighbors:
        s_c = course_slots.get(fn.course_id)
        if s_c:
            rel = get_slot_relation(slot_meta, s_c, fn.slot_id)
            cost += fn.shared_students * pen_table.get(rel, 0.0)

    return float(cost)


def repair(ds: Dataset, tt: Timetable, sp: SubProblem, bits: str) -> dict[str, str] | None:
    """While violations exist, flips back to slot A the changed course whose reversal

    yields the lowest cost increase (ties broken by smaller enrollment), up to len(courses) flips.
    Returns None if still infeasible after all flips.
    """
    current_bits = [int(b) for b in bits[: len(sp.courses)]]
    if len(current_bits) < len(sp.courses):
        current_bits.extend([0] * (len(sp.courses) - len(current_bits)))

    current_changes = decode(sp, "".join(str(b) for b in current_bits))
    if not validate(ds, tt, current_changes):
        return current_changes

    # Set of course indices currently flipped to slot B (bit == 1)
    flipped_indices = [i for i, b in enumerate(current_bits) if b == 1]
    if not flipped_indices:
        # All zeros already tested and infeasible
        return None

    # Up to len(sp.courses) flips
    max_flips = len(sp.courses)
    flips_done = 0

    while flipped_indices and flips_done < max_flips:
        flips_done += 1
        current_energy = compute_qubo_energy(sp, current_bits)

        # Evaluate cost increase for flipping each active course back to slot A
        best_idx: int | None = None
        best_reversal_key = (float("inf"), float("inf"), "")

        for idx in flipped_indices:
            course = sp.courses[idx]
            size = sp.sizes.get(course, 0)

            # Tentatively flip idx to 0
            candidate_vec = list(current_bits)
            candidate_vec[idx] = 0
            cand_energy = compute_qubo_energy(sp, candidate_vec)
            delta_cost = cand_energy - current_energy

            # Reversal key: lowest delta_cost, then smaller course enrollment, then course id
            reversal_key = (delta_cost, size, course)
            if reversal_key < best_reversal_key:
                best_reversal_key = reversal_key
                best_idx = idx

        if best_idx is None:
            break

        # Commit flip back to slot A
        current_bits[best_idx] = 0
        flipped_indices.remove(best_idx)

        # Check feasibility
        current_changes = decode(sp, "".join(str(b) for b in current_bits))
        if not validate(ds, tt, current_changes):
            return current_changes

    return None


def construct_repaired_timetable(
    ds: Dataset,
    tt: Timetable,
    changes: dict[str, str],
) -> Timetable:
    """Builds a complete, room-assigned Timetable object applying changes."""
    orig_slot_map = {a.course_id: a.slot_id for a in tt.assignments}
    new_slot_map = dict(orig_slot_map)
    for c, s in changes.items():
        new_slot_map[c] = s

    changed_slots = {
        new_slot_map[c]
        for c in changes
        if new_slot_map[c] != orig_slot_map.get(c)
    } | {
        orig_slot_map[c]
        for c in changes
        if new_slot_map[c] != orig_slot_map.get(c)
    }

    slot_courses: dict[str, list[str]] = defaultdict(list)
    for c, s in new_slot_map.items():
        slot_courses[s].append(c)

    course_enrollments = {c.course_id: 0 for c in ds.courses}
    for e in ds.enrollments:
        course_enrollments[e.course_id] = course_enrollments.get(e.course_id, 0) + 1

    new_assignments: list[Assignment] = []
    for a in tt.assignments:
        target_slot = new_slot_map[a.course_id]
        if target_slot in changed_slots:
            c_list = slot_courses[target_slot]
            alloc = solve_room_allocation_cpsat(c_list, course_enrollments, ds.rooms)
            if not alloc:
                alloc = assign_rooms_best_fit(c_list, course_enrollments, ds.rooms)
            room_ids = alloc.get(a.course_id, a.room_ids)
        else:
            room_ids = a.room_ids

        new_assignments.append(
            Assignment(
                course_id=a.course_id,
                slot_id=target_slot,
                room_ids=room_ids,
            )
        )

    cand_tt = Timetable(
        run_id=f"{tt.run_id}_repaired",
        assignments=new_assignments,
        hard_violations=0,
        soft_score=0.0,
        seed=tt.seed,
    )
    return score_timetable(ds, cand_tt)


def decide(
    ds: Dataset,
    tt: Timetable,
    sp: SubProblem,
    qr: QuantumResult,
) -> FinalDecision:
    """Authoritative acceptance or fallback decision gate.

    Takes the top 32 bitstrings by count, decodes, validates, and repairs.
    Picks the candidate with strictly lowest soft score below baseline and hard_violations == 0.
    Otherwise returns FinalDecision(source='baseline_fallback') preserving baseline.
    """
    before_score = tt.soft_score
    best_candidate_map: dict[str, str] | None = None
    best_score = before_score
    best_repaired_score_seen = float("inf")
    feasible_count = 0

    top_bitstrings = qr.top_bitstrings[:32]
    total_evaluated = max(1, len(top_bitstrings))

    for b_item in top_bitstrings:
        repaired_changes = repair(ds, tt, sp, b_item.bits)
        if repaired_changes is not None:
            feasible_count += 1
            cand_tt = construct_repaired_timetable(ds, tt, repaired_changes)
            if cand_tt.hard_violations == 0:
                best_repaired_score_seen = min(best_repaired_score_seen, cand_tt.soft_score)
                if cand_tt.soft_score < best_score:
                    best_score = cand_tt.soft_score
                    best_candidate_map = repaired_changes

    feasible_fraction = feasible_count / total_evaluated

    if best_candidate_map and best_score < before_score:
        changes_list: list[tuple[str, str, str]] = []
        for c in sp.courses:
            orig_s = sp.candidates[c][0]
            new_s = best_candidate_map.get(c, orig_s)
            if new_s != orig_s:
                changes_list.append((c, orig_s, new_s))

        resolved = int(before_score - best_score)
        return FinalDecision(
            cluster_id=sp.cluster_id,
            source="quantum_repaired",
            before_score=before_score,
            after_score=best_score,
            resolved_students=resolved,
            hard_violations=0,
            changes=changes_list,
            feasible_fraction=feasible_fraction,
            reason=(
                f"Quantum QAOA candidate accepted: soft penalty reduced from "
                f"{before_score:.1f} to {best_score:.1f} with 0 hard violations."
            ),
        )

    # Baseline fallback
    if best_repaired_score_seen < float("inf"):
        reason = (
            f"Maintained certified baseline: best repaired candidate soft score "
            f"({best_repaired_score_seen:.1f}) did not strictly improve upon baseline ({before_score:.1f})."
        )
    else:
        reason = (
            f"Maintained certified baseline: all sampled quantum bitstrings were infeasible "
            f"({before_score:.1f})."
        )

    return FinalDecision(
        cluster_id=sp.cluster_id,
        source="baseline_fallback",
        before_score=before_score,
        after_score=before_score,
        resolved_students=0,
        hard_violations=0,
        changes=[],
        feasible_fraction=feasible_fraction,
        reason=reason,
    )
