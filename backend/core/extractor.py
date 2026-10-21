"""Conflict matrix analyzer and dense bottleneck cluster extractor.

Task: A3 (Member A: Classical core + backend)
Triggers: HO-02 (SubProblem fixtures)
Reference: docs/CONTRACTS.md Section 4, docs/QUBO_SPEC.md, and tasks/A_backend.md
"""
from __future__ import annotations

from collections import defaultdict

import networkx as nx

from backend.schemas import (
    Dataset,
    FixedNeighbor,
    PairWeight,
    SubProblem,
    Timetable,
)

DEFAULT_PENALTY_TABLE: dict[str, float] = {
    "same_slot": 1000.0,
    "adjacent_same_day": 10.0,
    "same_day": 1.0,
    "none": 0.0,
}


def get_slot_relation(
    slot_meta: dict[str, tuple[int, int]],
    s: str,
    t: str,
) -> str:
    """Computes relationship between two time slots:

    - 'same_slot': s == t
    - 'adjacent_same_day': same day and |order_s - order_t| == 1
    - 'same_day': same day and |order_s - order_t| > 1
    - 'none': different days or slot missing from meta
    """
    if s == t:
        return "same_slot"
    if s not in slot_meta or t not in slot_meta:
        return "none"
    day_s, order_s = slot_meta[s]
    day_t, order_t = slot_meta[t]
    if day_s == day_t:
        if abs(order_s - order_t) == 1:
            return "adjacent_same_day"
        return "same_day"
    return "none"


def compute_baseline_energy(
    courses: list[str],
    candidates: dict[str, tuple[str, str]],
    pair_weights: list[PairWeight],
    fixed_neighbors: list[FixedNeighbor],
    slot_meta: dict[str, tuple[int, int]],
    penalty_table: dict[str, float],
) -> float:
    """Exact classical QUBO energy of the all-zeros assignment (x = 0).

    Matches docs/QUBO_SPEC.md Section 3:
    E(0) = sum_{(c,d) in pair_weights} n_cd * pen(rel(slot_c(0), slot_d(0)))
         + sum_{fn in fixed_neighbors} n_fn * pen(rel(slot_c(0), slot_fixed))
    """
    cost = 0.0
    for pw in pair_weights:
        s_a = candidates[pw.a][0]
        s_b = candidates[pw.b][0]
        rel = get_slot_relation(slot_meta, s_a, s_b)
        cost += pw.shared_students * penalty_table.get(rel, 0.0)

    for fn in fixed_neighbors:
        s_c = candidates[fn.course_id][0]
        rel = get_slot_relation(slot_meta, s_c, fn.slot_id)
        cost += fn.shared_students * penalty_table.get(rel, 0.0)

    return float(cost)


def extract_clusters(
    ds: Dataset,
    tt: Timetable,
    max_size: int = 12,
    top_k: int = 5,
) -> list[SubProblem]:
    """Carves out dense soft-penalty bottleneck subgraphs from the baseline schedule.

    Pipeline:
    1. Build a NetworkX graph with courses as nodes and shared-student counts as edge weights.
    2. Compute per-edge penalty weight from the baseline timetable assignments.
    3. Find dense clusters: iteratively seed from the highest-penalty edge, grow greedily
       by adding the neighbor with the highest total penalized weight to the cluster
       until max_size, then rank clusters by total penalized student count, enforcing
       <= 50% overlap between returned clusters.
    4. For each cluster course, compute candidate slot B = the slot (!= current) that minimizes
       added cost against cluster-external neighbors, subject to spare capacity >= enrollment
       (using spare_capacity excluding cluster courses) and skipping slots creating hard clashes
       with fixed neighbors; drop courses with no valid B.
    5. Fill sizes, pair_weights, fixed_neighbors, spare_capacity, slot_meta, penalty_table,
       affected_students, baseline_cluster_cost. Hard cap len(courses) in [4, 14].
    """
    # 0. Fast lookups and metadata
    slot_meta: dict[str, tuple[int, int]] = {
        s.slot_id: (s.day, s.order) for s in sorted(ds.slots, key=lambda s: (s.day, s.order, s.slot_id))
    }
    course_to_slot: dict[str, str] = {a.course_id: a.slot_id for a in tt.assignments}

    # Total room capacity available in each slot
    total_slot_capacity: dict[str, int] = {
        s.slot_id: sum(r.capacity for r in ds.rooms) for s in ds.slots
    }

    # Course enrollments and student enrollments
    course_enrollments: dict[str, int] = defaultdict(int)
    course_students: dict[str, set[str]] = defaultdict(set)
    student_courses: dict[str, set[str]] = defaultdict(set)
    for e in ds.enrollments:
        course_enrollments[e.course_id] += 1
        course_students[e.course_id].add(e.student_id)
        student_courses[e.student_id].add(e.course_id)

    # 1. Build NetworkX conflict graph with courses as nodes and shared-student counts
    G = nx.Graph()
    for c in ds.courses:
        G.add_node(c.course_id)

    shared_counts: dict[tuple[str, str], int] = defaultdict(int)
    for s_id, courses in student_courses.items():
        c_list = sorted(courses)
        for i in range(len(c_list)):
            for j in range(i + 1, len(c_list)):
                shared_counts[(c_list[i], c_list[j])] += 1

    for (c1, c2), count in shared_counts.items():
        if count > 0:
            G.add_edge(c1, c2, shared_students=count)

    # 2. Compute per-edge penalty weight from the baseline
    # Edges whose two courses sit in adjacent same-day slots or same day get weight shared_students * pen
    edge_penalties: dict[tuple[str, str], float] = {}
    for (c1, c2), count in shared_counts.items():
        slot1 = course_to_slot.get(c1)
        slot2 = course_to_slot.get(c2)
        if not slot1 or not slot2:
            continue
        rel = get_slot_relation(slot_meta, slot1, slot2)
        pen = DEFAULT_PENALTY_TABLE.get(rel, 0.0)
        pen_weight = float(count * pen)
        if pen_weight > 0.0:
            edge_penalties[(c1, c2)] = pen_weight
            edge_penalties[(c2, c1)] = pen_weight

    if not edge_penalties:
        return []

    # 3. Find dense clusters: iteratively seed from highest-penalty edge, grow greedily
    # Sort candidate seed edges descending by penalty weight, then shared students
    unique_seed_edges = [
        (c1, c2, w) for (c1, c2), w in edge_penalties.items() if c1 < c2
    ]
    unique_seed_edges.sort(
        key=lambda item: (item[2], shared_counts.get((item[0], item[1]), 0), item[0], item[1]),
        reverse=True,
    )

    candidate_clusters: list[list[str]] = []
    seen_seeds: set[frozenset[str]] = set()

    # Allow slight growth cushion during initial expansion so that after
    # candidate B drop filtering, clusters can achieve up to effective_max_size
    effective_max_size = min(max(max_size, 4), 14)
    initial_growth_cap = min(effective_max_size + 3, 14)

    for c1, c2, _ in unique_seed_edges:
        seed_pair = frozenset([c1, c2])
        if seed_pair in seen_seeds:
            continue
        seen_seeds.add(seed_pair)

        cluster: list[str] = [c1, c2]
        cluster_set: set[str] = {c1, c2}

        # Grow cluster greedily by adding neighbor with highest total penalized weight to current cluster
        while len(cluster) < initial_growth_cap:
            neighbor_scores: dict[str, float] = defaultdict(float)
            for curr_node in cluster:
                for nbr in G.neighbors(curr_node):
                    if nbr not in cluster_set:
                        pw = edge_penalties.get((nbr, curr_node), 0.0)
                        if pw > 0.0:
                            neighbor_scores[nbr] += pw

            if not neighbor_scores:
                # No more connected neighbors with baseline penalty
                break

            # Pick neighbor with highest total penalized weight
            best_nbr = max(
                neighbor_scores.keys(),
                key=lambda nbr: (neighbor_scores[nbr], course_enrollments.get(nbr, 0), nbr),
            )
            cluster.append(best_nbr)
            cluster_set.add(best_nbr)

        if len(cluster) >= 4:
            candidate_clusters.append(cluster)

    # Rank candidate clusters by total penalized student count within the cluster
    def cluster_score(courses_list: list[str]) -> float:
        score = 0.0
        n = len(courses_list)
        for i in range(n):
            for j in range(i + 1, n):
                score += edge_penalties.get((courses_list[i], courses_list[j]), 0.0)
        return score

    candidate_clusters.sort(
        key=lambda cl: (cluster_score(cl), len(cl), sorted(cl)),
        reverse=True,
    )

    # Enforce <= 50% overlap between distinct returned clusters
    selected_clusters: list[list[str]] = []
    for cl in candidate_clusters:
        cl_set = set(cl)
        too_much_overlap = False
        for accepted in selected_clusters:
            accepted_set = set(accepted)
            overlap = len(cl_set & accepted_set)
            # Enforce overlap ratio <= 50% of the smaller cluster
            if overlap / min(len(cl_set), len(accepted_set)) > 0.50:
                too_much_overlap = True
                break
        if not too_much_overlap:
            selected_clusters.append(cl)
            if len(selected_clusters) >= top_k * 2:  # pool enough before B-slot filtering
                break

    # 4. For each cluster course, compute candidate slot B and construct SubProblem
    subproblems: list[SubProblem] = []
    all_slots = sorted(ds.slots, key=lambda s: (s.day, s.order, s.slot_id))

    for cl_courses in selected_clusters:
        if len(subproblems) >= top_k:
            break

        current_cluster = list(cl_courses)

        # Iteratively prune courses that cannot find a clash-free, capacity-valid candidate B
        while True:
            cluster_set = set(current_cluster)
            if len(current_cluster) < 4:
                break

            # Compute spare capacity per slot excluding current cluster courses
            # spare_capacity[s] = total_slot_capacity[s] - non_cluster_load[s]
            non_cluster_load: dict[str, int] = defaultdict(int)
            for c_id, s_id in course_to_slot.items():
                if c_id not in cluster_set:
                    non_cluster_load[s_id] += course_enrollments.get(c_id, 0)

            spare_capacity: dict[str, int] = {
                s.slot_id: max(0, total_slot_capacity[s.slot_id] - non_cluster_load[s.slot_id])
                for s in all_slots
            }

            # Map external fixed neighbors for each cluster course
            # fixed_clash_slots[c]: set of slots where an external neighbor with shared students is scheduled
            fixed_clash_slots: dict[str, set[str]] = defaultdict(set)
            external_neighbors_map: dict[str, list[tuple[str, int]]] = defaultdict(list)
            for c in current_cluster:
                for nbr in G.neighbors(c):
                    if nbr not in cluster_set:
                        nbr_slot = course_to_slot.get(nbr)
                        shared_st = shared_counts.get((min(c, nbr), max(c, nbr)), 0)
                        if nbr_slot and shared_st > 0:
                            fixed_clash_slots[c].add(nbr_slot)
                            external_neighbors_map[c].append((nbr_slot, shared_st))

            # Evaluate candidate B for each course in current cluster
            course_candidates: dict[str, tuple[str, str]] = {}
            drop_courses: list[str] = []

            for c in current_cluster:
                slot_a = course_to_slot.get(c, all_slots[0].slot_id)
                c_size = course_enrollments.get(c, 0)

                best_slot_b: str | None = None
                best_b_cost = float("inf")

                for cand_slot in all_slots:
                    s_b_id = cand_slot.slot_id
                    if s_b_id == slot_a:
                        continue  # Must be distinct from slot A

                    # Constraint 1: Spare capacity in that slot >= course enrollment
                    if spare_capacity.get(s_b_id, 0) < c_size:
                        continue

                    # Constraint 2: Skip slots creating a hard clash with fixed external neighbors
                    if s_b_id in fixed_clash_slots[c]:
                        continue

                    # Added penalty cost against cluster-external neighbors
                    added_cost = 0.0
                    for nbr_slot, n_shared in external_neighbors_map[c]:
                        rel = get_slot_relation(slot_meta, s_b_id, nbr_slot)
                        added_cost += n_shared * DEFAULT_PENALTY_TABLE.get(rel, 0.0)

                    # Choose slot that minimizes added cost (deterministic tiebreak by slot day/order/id)
                    s_meta = slot_meta[s_b_id]
                    if (
                        added_cost < best_b_cost
                        or (
                            abs(added_cost - best_b_cost) < 1e-9
                            and best_slot_b is not None
                            and (s_meta[0], s_meta[1], s_b_id)
                            < (slot_meta[best_slot_b][0], slot_meta[best_slot_b][1], best_slot_b)
                        )
                    ):
                        best_b_cost = added_cost
                        best_slot_b = s_b_id

                if best_slot_b is None:
                    drop_courses.append(c)
                else:
                    course_candidates[c] = (slot_a, best_slot_b)

            if not drop_courses:
                # All remaining cluster courses have a valid candidate B
                break

            # Drop offending courses and repeat check
            for c in drop_courses:
                current_cluster.remove(c)

        # Enforce size bounds: min 4, cap at effective_max_size (<= 14)
        if len(current_cluster) < 4:
            continue
        if len(current_cluster) > effective_max_size:
            current_cluster = current_cluster[:effective_max_size]

        # 5. Assemble SubProblem components
        final_courses = sorted(current_cluster)
        final_cluster_set = set(final_courses)

        # Pair weights between cluster courses
        sub_pair_weights: list[PairWeight] = []
        for i in range(len(final_courses)):
            for j in range(i + 1, len(final_courses)):
                ca = final_courses[i]
                cb = final_courses[j]
                n_shared = shared_counts.get((min(ca, cb), max(ca, cb)), 0)
                if n_shared > 0:
                    sub_pair_weights.append(
                        PairWeight(a=ca, b=cb, shared_students=n_shared)
                    )

        # Fixed neighbors: external courses connected to cluster courses
        # Aggregated by (cluster_course_id, slot_id) to match QUBO linear penalty term
        fixed_nb_dict: dict[tuple[str, str], int] = defaultdict(int)
        for ca in final_courses:
            for nbr in G.neighbors(ca):
                if nbr not in final_cluster_set:
                    nbr_slot = course_to_slot.get(nbr)
                    n_shared = shared_counts.get((min(ca, nbr), max(ca, nbr)), 0)
                    if nbr_slot and n_shared > 0:
                        fixed_nb_dict[(ca, nbr_slot)] += n_shared

        sub_fixed_neighbors: list[FixedNeighbor] = [
            FixedNeighbor(course_id=ca, slot_id=s_id, shared_students=cnt)
            for (ca, s_id), cnt in sorted(fixed_nb_dict.items())
        ]

        # Affected students: unique students taking at least one course in the cluster
        affected_st_set: set[str] = set()
        for ca in final_courses:
            affected_st_set.update(course_students[ca])

        # Baseline cluster cost equals the exact QUBO energy at x = 0
        baseline_cost = compute_baseline_energy(
            courses=final_courses,
            candidates=course_candidates,
            pair_weights=sub_pair_weights,
            fixed_neighbors=sub_fixed_neighbors,
            slot_meta=slot_meta,
            penalty_table=DEFAULT_PENALTY_TABLE,
        )

        cluster_id = f"cluster_{len(subproblems) + 1:02d}"
        subproblems.append(
            SubProblem(
                cluster_id=cluster_id,
                courses=final_courses,
                candidates={c: course_candidates[c] for c in final_courses},
                sizes={c: course_enrollments.get(c, 0) for c in final_courses},
                pair_weights=sub_pair_weights,
                fixed_neighbors=sub_fixed_neighbors,
                spare_capacity=spare_capacity,
                slot_meta=slot_meta,
                penalty_table=DEFAULT_PENALTY_TABLE,
                affected_students=len(affected_st_set),
                baseline_cluster_cost=baseline_cost,
            )
        )

    return subproblems
