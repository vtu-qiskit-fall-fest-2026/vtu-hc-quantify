"""QUBO formulation and Ising Hamiltonian mapping for QUANTA bottleneck clusters.

Owner: Member B (Quantum + benchmarks)
Reference: docs/QUBO_SPEC.md (Sections 1-6) and docs/CONTRACTS.md
"""
from __future__ import annotations

import numpy as np
from qiskit.quantum_info import SparsePauliOp
from qiskit_optimization import QuadraticProgram

from backend.schemas import QuantumConfig, SubProblem


def slot_relation(slot_meta: dict[str, tuple[int, int]], s: str, t: str) -> str:
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


def energy(sp: SubProblem, cfg: QuantumConfig, x: list[int]) -> float:
    """Direct classical evaluation of the cluster cost objective without QuadraticProgram.

    Formula per docs/QUBO_SPEC.md Section 3:
    E(x) = sum_{(c,d) in pair_weights} n_cd * pen(rel(slot_c(x_c), slot_d(x_d)))
         + sum_{c} sum_{k in fixed_neighbors(c)} n_ck * pen(rel(slot_c(x_c), slot_k))
         + lambda_cap * sum_{(c,d)} [x_c, x_d put both into same slot t and size_c + size_d > spare_t]
    """
    pen_table = {**sp.penalty_table, **cfg.penalty_overrides}
    course_slots: dict[str, str] = {}
    for i, c in enumerate(sp.courses):
        val = x[i] if i < len(x) else 0
        cand_a, cand_b = sp.candidates[c]
        course_slots[c] = cand_b if val == 1 else cand_a

    cost = 0.0

    # 1. Pairwise cluster student conflict penalties
    for pw in sp.pair_weights:
        s_c = course_slots.get(pw.a)
        s_d = course_slots.get(pw.b)
        if s_c and s_d:
            rel = slot_relation(sp.slot_meta, s_c, s_d)
            cost += pw.shared_students * pen_table.get(rel, 0.0)

    # 2. Fixed external neighbor penalties (when course_id is in cluster)
    for fn in sp.fixed_neighbors:
        s_c = course_slots.get(fn.course_id)
        if s_c:
            rel = slot_relation(sp.slot_meta, s_c, fn.slot_id)
            cost += fn.shared_students * pen_table.get(rel, 0.0)

    # 3. Optional pairwise capacity penalty approximation
    if cfg.lambda_cap > 0:
        n = len(sp.courses)
        for i in range(n):
            c_i = sp.courses[i]
            s_i = course_slots[c_i]
            for j in range(i + 1, n):
                c_j = sp.courses[j]
                s_j = course_slots[c_j]
                if s_i == s_j:
                    spare = sp.spare_capacity.get(s_i, 0)
                    if sp.sizes.get(c_i, 0) + sp.sizes.get(c_j, 0) > spare:
                        cost += cfg.lambda_cap

    return float(cost)


def build_qubo(sp: SubProblem, cfg: QuantumConfig) -> QuadraticProgram:
    """Builds a QuadraticProgram with n binary variables matching the exact QUBO expansion.

    Expansion per docs/QUBO_SPEC.md Section 4:
    f(xc, xd) = f00 + (f10 - f00) xc + (f01 - f00) xd + (f00 - f01 - f10 + f11) xc xd
    g(xc) = g0 + (g1 - g0) xc
    """
    pen_table = {**sp.penalty_table, **cfg.penalty_overrides}
    course_to_idx = {c: i for i, c in enumerate(sp.courses)}

    offset = 0.0
    linear: dict[str, float] = {c: 0.0 for c in sp.courses}
    quadratic: dict[tuple[str, str], float] = {}

    # Pairwise terms
    for pw in sp.pair_weights:
        c, d = pw.a, pw.b
        if c not in course_to_idx or d not in course_to_idx:
            continue
        idx_c, idx_d = course_to_idx[c], course_to_idx[d]
        slots_c = sp.candidates[c]
        slots_d = sp.candidates[d]

        f = np.zeros((2, 2), dtype=float)
        for a_val in (0, 1):
            for b_val in (0, 1):
                s_c = slots_c[a_val]
                s_d = slots_d[b_val]
                rel = slot_relation(sp.slot_meta, s_c, s_d)
                val = pw.shared_students * pen_table.get(rel, 0.0)
                if cfg.lambda_cap > 0 and s_c == s_d:
                    spare = sp.spare_capacity.get(s_c, 0)
                    if sp.sizes.get(c, 0) + sp.sizes.get(d, 0) > spare:
                        val += cfg.lambda_cap
                f[a_val, b_val] = val

        f00, f10, f01, f11 = f[0, 0], f[1, 0], f[0, 1], f[1, 1]
        offset += f00
        linear[c] += (f10 - f00)
        linear[d] += (f01 - f00)

        q_coeff = f00 - f01 - f10 + f11
        if abs(q_coeff) > 1e-12:
            pair_key = (c, d) if idx_c < idx_d else (d, c)
            quadratic[pair_key] = quadratic.get(pair_key, 0.0) + q_coeff

    # Fixed neighbor linear terms
    for fn in sp.fixed_neighbors:
        if fn.course_id in course_to_idx:
            c = fn.course_id
            slots_c = sp.candidates[c]
            g0 = fn.shared_students * pen_table.get(slot_relation(sp.slot_meta, slots_c[0], fn.slot_id), 0.0)
            g1 = fn.shared_students * pen_table.get(slot_relation(sp.slot_meta, slots_c[1], fn.slot_id), 0.0)
            offset += g0
            linear[c] += (g1 - g0)

    # Construct QuadraticProgram
    qp = QuadraticProgram(name=f"QUBO_{sp.cluster_id}")
    for c in sp.courses:
        qp.binary_var(name=c)

    # Filter out near-zero quadratic coefficients for clean representation
    cleaned_quad = {k: v for k, v in quadratic.items() if abs(v) > 1e-12}
    qp.minimize(constant=offset, linear=linear, quadratic=cleaned_quad)

    return qp


def to_ising(qp: QuadraticProgram) -> tuple[SparsePauliOp, float]:
    """Converts a QuadraticProgram to an Ising Hamiltonian (SparsePauliOp) and energy offset.

    Uses QuadraticProgram.to_ising() if available, with an exact manual conversion fallback.
    Per docs/QUBO_SPEC.md Section 5:
    x_i = (I - Z_i) / 2
    linear a_i x_i      -> a_i/2 (I - Z_i)
    quad   b_ij x_i x_j -> b_ij/4 (I - Z_i - Z_j + Z_i Z_j)
    """
    if hasattr(qp, "to_ising"):
        H, offset = qp.to_ising()
        return H, float(offset)

    # Manual conversion fallback
    n = qp.get_num_binary_vars()
    var_names = [v.name for v in qp.variables]
    var_to_qubit = {name: i for i, name in enumerate(var_names)}

    constant = qp.objective.constant
    linear = qp.objective.linear.to_dict()
    quadratic = qp.objective.quadratic.to_dict()

    offset = float(constant)
    pauli_dict: dict[str, complex] = {}

    def add_term(pauli_str: str, coeff: complex) -> None:
        if abs(coeff) > 1e-12:
            pauli_dict[pauli_str] = pauli_dict.get(pauli_str, 0.0j) + coeff

    # Linear terms: a_i * (I - Z_i) / 2
    for var, coeff in linear.items():
        if abs(coeff) < 1e-12:
            continue
        q = var_to_qubit[var] if isinstance(var, str) else int(var)
        offset += coeff / 2.0
        # Qiskit bitstring has qubit 0 rightmost: string index n - 1 - q
        z_chars = ["I"] * n
        z_chars[n - 1 - q] = "Z"
        add_term("".join(z_chars), -coeff / 2.0)

    # Quadratic terms: b_ij * (I - Z_i - Z_j + Z_i Z_j) / 4
    for (v1, v2), coeff in quadratic.items():
        if abs(coeff) < 1e-12:
            continue
        q1 = var_to_qubit[v1] if isinstance(v1, str) else int(v1)
        q2 = var_to_qubit[v2] if isinstance(v2, str) else int(v2)
        offset += coeff / 4.0

        # - Z_i
        z1_chars = ["I"] * n
        z1_chars[n - 1 - q1] = "Z"
        add_term("".join(z1_chars), -coeff / 4.0)

        # - Z_j
        z2_chars = ["I"] * n
        z2_chars[n - 1 - q2] = "Z"
        add_term("".join(z2_chars), -coeff / 4.0)

        # + Z_i Z_j
        zz_chars = ["I"] * n
        zz_chars[n - 1 - q1] = "Z"
        zz_chars[n - 1 - q2] = "Z"
        add_term("".join(zz_chars), coeff / 4.0)

    if not pauli_dict:
        return SparsePauliOp(["I" * n], coeffs=[0.0]), offset

    labels = list(pauli_dict.keys())
    coeffs = list(pauli_dict.values())
    return SparsePauliOp(labels, coeffs=coeffs), offset


def brute_force(sp: SubProblem, cfg: QuantumConfig) -> dict:
    """Exact 2^n ground truth oracle evaluating all states for n <= 14."""
    n = len(sp.courses)
    total_states = 1 << n
    energies = np.zeros(total_states, dtype=float)
    ground_energy = float("inf")
    best_state_int = 0

    for state_int in range(total_states):
        # Assignment bits: x_i is bit i (qubit i)
        x = [(state_int >> i) & 1 for i in range(n)]
        e = energy(sp, cfg, x)
        energies[state_int] = e
        if e < ground_energy:
            ground_energy = e
            best_state_int = state_int

    ground_x = [(best_state_int >> i) & 1 for i in range(n)]

    return {
        "ground_x": ground_x,
        "ground_energy": float(ground_energy),
        "max_energy": float(np.max(energies)),
        "energies": energies,
    }
