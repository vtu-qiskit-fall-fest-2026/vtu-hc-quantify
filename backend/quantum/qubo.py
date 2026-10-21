"""QUBO and Ising Hamiltonian formulation for bottleneck clusters."""
from __future__ import annotations

import numpy as np
from backend.schemas import SubProblem, QuantumConfig


def slot_relation(slot_meta: dict[str, tuple[int, int]], s: str, t: str) -> str:
    """Computes relationship between two time slots:
    - 'same_slot': s == t
    - 'adjacent_same_day': same day and |order_s - order_t| == 1
    - 'same_day': same day and |order_s - order_t| > 1
    - 'none': different days
    """
    if s == t:
        return "same_slot"
    day_s, order_s = slot_meta.get(s, (0, 0))
    day_t, order_t = slot_meta.get(t, (0, 0))
    if day_s == day_t:
        if abs(order_s - order_t) == 1:
            return "adjacent_same_day"
        return "same_day"
    return "none"


def energy(sp: SubProblem, cfg: QuantumConfig, x: list[int]) -> float:
    """Direct classical evaluation of the cluster QUBO objective."""
    pen_table = {**sp.penalty_table, **cfg.penalty_overrides}
    course_slots = {}
    for i, c in enumerate(sp.courses):
        val = x[i] if i < len(x) else 0
        cand_a, cand_b = sp.candidates[c]
        course_slots[c] = cand_b if val == 1 else cand_a

    cost = 0.0

    # Pairwise cluster course penalties
    for pw in sp.pair_weights:
        s_c = course_slots.get(pw.a)
        s_d = course_slots.get(pw.b)
        if s_c and s_d:
            rel = slot_relation(sp.slot_meta, s_c, s_d)
            cost += pw.shared_students * pen_table.get(rel, 0.0)

    # Fixed neighbor penalties
    for fn in sp.fixed_neighbors:
        s_c = course_slots.get(fn.course_id)
        if s_c:
            rel = slot_relation(sp.slot_meta, s_c, fn.slot_id)
            cost += fn.shared_students * pen_table.get(rel, 0.0)

    return float(cost)


def brute_force(sp: SubProblem, cfg: QuantumConfig) -> dict:
    """Exact 2^n ground truth oracle (for n <= 14)."""
    n = len(sp.courses)
    total_states = 1 << n
    energies = np.zeros(total_states)
    ground_energy = float("inf")
    ground_x = [0] * n

    for state_int in range(total_states):
        # Convert integer to assignment bits [x_0, ..., x_{n-1}]
        x = [(state_int >> i) & 1 for i in range(n)]
        e = energy(sp, cfg, x)
        energies[state_int] = e
        if e < ground_energy:
            ground_energy = e
            ground_x = x

    return {
        "ground_x": ground_x,
        "ground_energy": ground_energy,
        "max_energy": float(np.max(energies)),
        "energies": energies,
    }
