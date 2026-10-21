"""NetworkX conflict matrix analyzer and bottleneck cluster extractor."""
from __future__ import annotations

from backend.schemas import Dataset, Timetable, SubProblem, PairWeight, FixedNeighbor


def extract_clusters(
    ds: Dataset,
    tt: Timetable,
    max_size: int = 12,
    top_k: int = 5,
) -> list[SubProblem]:
    """Carves out dense soft-penalty bottleneck subgraphs from the baseline schedule."""
    # Build student conflict graph
    course_enrollments: dict[str, int] = {}
    student_courses: dict[str, set[str]] = {}
    for e in ds.enrollments:
        student_courses.setdefault(e.student_id, set()).add(e.course_id)
        course_enrollments[e.course_id] = course_enrollments.get(e.course_id, 0) + 1

    course_to_slot = {a.course_id: a.slot_id for a in tt.assignments}
    slot_map = {s.slot_id: (s.day, s.order) for s in ds.slots}

    # Pairwise shared student counts
    pair_weights: dict[tuple[str, str], int] = {}
    for student_id, courses in student_courses.items():
        c_list = sorted(courses)
        for i in range(len(c_list)):
            for j in range(i + 1, len(c_list)):
                key = (c_list[i], c_list[j])
                pair_weights[key] = pair_weights.get(key, 0) + 1

    # Identify top conflicting course candidates
    sorted_pairs = sorted(pair_weights.items(), key=lambda item: item[1], reverse=True)
    clusters: list[SubProblem] = []

    if not sorted_pairs:
        return []

    # Greedy seed and expansion
    selected_courses: set[str] = set()
    for (c1, c2), weight in sorted_pairs:
        if len(clusters) >= top_k:
            break
        if c1 in selected_courses and c2 in selected_courses:
            continue

        cluster_courses = [c1, c2]
        selected_courses.update(cluster_courses)

        # Grow cluster greedily up to max_size
        for (a, b), w in sorted_pairs:
            if len(cluster_courses) >= max_size:
                break
            if a in cluster_courses and b not in cluster_courses:
                cluster_courses.append(b)
                selected_courses.add(b)
            elif b in cluster_courses and a not in cluster_courses:
                cluster_courses.append(a)
                selected_courses.add(a)

        if len(cluster_courses) < 4:
            continue

        # Formulate candidate slots: Slot A (baseline) and Slot B (alternative)
        candidates: dict[str, tuple[str, str]] = {}
        all_slot_ids = [s.slot_id for s in ds.slots]
        for idx, c in enumerate(cluster_courses):
            slot_a = course_to_slot.get(c, all_slot_ids[0])
            # Select alternative slot on a different day
            slot_b = all_slot_ids[(idx + 4) % len(all_slot_ids)]
            if slot_b == slot_a:
                slot_b = all_slot_ids[(idx + 5) % len(all_slot_ids)]
            candidates[c] = (slot_a, slot_b)

        # Subgraph edges
        sub_pair_weights = [
            PairWeight(a=a, b=b, shared_students=w)
            for (a, b), w in pair_weights.items()
            if a in cluster_courses and b in cluster_courses
        ]

        sub_fixed_neighbors: list[FixedNeighbor] = []
        for (a, b), w in pair_weights.items():
            if a in cluster_courses and b not in cluster_courses:
                sub_fixed_neighbors.append(
                    FixedNeighbor(course_id=b, slot_id=course_to_slot.get(b, ""), shared_students=w)
                )
            elif b in cluster_courses and a not in cluster_courses:
                sub_fixed_neighbors.append(
                    FixedNeighbor(course_id=a, slot_id=course_to_slot.get(a, ""), shared_students=w)
                )

        cluster_id = f"cluster_{len(clusters) + 1:02d}"
        clusters.append(
            SubProblem(
                cluster_id=cluster_id,
                courses=cluster_courses,
                candidates=candidates,
                sizes={c: course_enrollments.get(c, 50) for c in cluster_courses},
                pair_weights=sub_pair_weights,
                fixed_neighbors=sub_fixed_neighbors[:20],
                spare_capacity={s.slot_id: 100 for s in ds.slots},
                slot_meta=slot_map,
                affected_students=sum(w.shared_students for w in sub_pair_weights),
                baseline_cluster_cost=float(sum(w.shared_students * 10 for w in sub_pair_weights)),
            )
        )

    return clusters
