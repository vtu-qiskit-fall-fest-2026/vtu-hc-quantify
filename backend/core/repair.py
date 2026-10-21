"""Deterministic classical repair heuristic and acceptance decision gate."""
from __future__ import annotations

from backend.schemas import Dataset, Timetable, SubProblem, QuantumResult, FinalDecision, Assignment
from backend.core.scorer import score_timetable


def decode(sp: SubProblem, bits: str) -> dict[str, str]:
    """Decodes normalized bitstring into course->slot mapping.
    bits[i] corresponds to course sp.courses[i].
    bit '0' -> candidate Slot A (current)
    bit '1' -> candidate Slot B (alternative)
    """
    changes: dict[str, str] = {}
    for i, c in enumerate(sp.courses):
        if i < len(bits):
            bit = bits[i]
            slot_a, slot_b = sp.candidates[c]
            changes[c] = slot_b if bit == "1" else slot_a
    return changes


def validate(ds: Dataset, tt: Timetable, changes: dict[str, str]) -> list[str]:
    """Verifies that applying candidate changes produces 0 hard violations."""
    new_assignments = []
    for a in tt.assignments:
        if a.course_id in changes:
            new_assignments.append(
                Assignment(course_id=a.course_id, slot_id=changes[a.course_id], room_ids=a.room_ids)
            )
        else:
            new_assignments.append(a)

    test_tt = Timetable(
        run_id="validate_test",
        assignments=new_assignments,
        hard_violations=0,
        soft_score=0.0,
        seed=tt.seed,
    )
    audited = score_timetable(ds, test_tt)
    if audited.hard_violations > 0:
        return [f"Produces {audited.hard_violations} hard student collisions or capacity overflows"]
    return []


def decide(ds: Dataset, tt: Timetable, sp: SubProblem, qr: QuantumResult) -> FinalDecision:
    """Accepts quantum solution ONLY IF hard_violations == 0 and soft score strictly improves."""
    before_score = tt.soft_score
    best_candidate: dict[str, str] | None = None
    best_score = before_score
    feasible_count = 0

    for bit_item in qr.top_bitstrings:
        candidate_slots = decode(sp, bit_item.bits)
        violations = validate(ds, tt, candidate_slots)
        if not violations:
            feasible_count += 1
            # Build proposed timetable
            new_assignments = [
                Assignment(course_id=a.course_id, slot_id=candidate_slots.get(a.course_id, a.slot_id), room_ids=a.room_ids)
                for a in tt.assignments
            ]
            cand_tt = score_timetable(
                ds,
                Timetable(run_id="candidate", assignments=new_assignments, seed=tt.seed),
            )
            if cand_tt.soft_score < best_score:
                best_score = cand_tt.soft_score
                best_candidate = candidate_slots

    feasible_fraction = feasible_count / max(1, len(qr.top_bitstrings))

    if best_candidate and best_score < before_score:
        # Changes made
        changes_list = []
        for c, new_s in best_candidate.items():
            orig_s = sp.candidates[c][0]
            if new_s != orig_s:
                changes_list.append((c, orig_s, new_s))

        return FinalDecision(
            cluster_id=sp.cluster_id,
            source="quantum_repaired",
            before_score=before_score,
            after_score=best_score,
            resolved_students=int(before_score - best_score),
            hard_violations=0,
            changes=changes_list,
            feasible_fraction=feasible_fraction,
            reason=f"Quantum QAOA candidate accepted: soft penalty reduced from {before_score:.1f} to {best_score:.1f} with 0 hard violations.",
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
        reason=f"Maintained certified baseline: best quantum candidate soft score ({best_score:.1f}) did not strictly improve upon baseline ({before_score:.1f}).",
    )
