"""Unit tests for QUBO formulation, Ising Hamiltonian mapping, and bit ordering.

Task: B1 (Member B: Quantum + benchmarks)
Reference: docs/QUBO_SPEC.md Section 11 (Acceptance tests)
"""
from pathlib import Path

import pytest
from qiskit.quantum_info import Statevector

from backend.quantum.bitorder import assignment_to_bits, bits_to_assignment
from backend.quantum.qubo import brute_force, build_qubo, energy, to_ising
from backend.schemas import QuantumConfig, SubProblem


@pytest.fixture
def subproblem_6() -> SubProblem:
    fixture_path = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "subproblem_6.json"
    with open(fixture_path, "r", encoding="utf-8") as f:
        return SubProblem.model_validate_json(f.read())


def test_bitorder_little_endian_convention():
    """Verify bitorder maps Qiskit rightmost character to qubit 0 (course 0)."""
    # Raw Qiskit bitstring where qubit 0 is '1' and qubit 5 is '0': "000001"
    raw_bitstring = "000001"
    assignment = bits_to_assignment(raw_bitstring)
    assert assignment == [1, 0, 0, 0, 0, 0]
    assert assignment[0] == 1
    assert assignment[5] == 0

    # Invert roundtrip
    reconstructed = assignment_to_bits(assignment)
    assert reconstructed == raw_bitstring

    # Arbitrary bitstring
    test_str = "101100"
    ass = bits_to_assignment(test_str)
    assert ass == [0, 0, 1, 1, 0, 1]
    assert assignment_to_bits(ass) == test_str


def test_qubo_and_ising_exact_parity_all_states(subproblem_6: SubProblem):
    """Verify for all 2^n states on subproblem_6: QUBO objective == energy() == <x|H|x> + offset."""
    sp = subproblem_6
    cfg = QuantumConfig(backend="ideal", lambda_cap=0.0)
    n = len(sp.courses)

    qp = build_qubo(sp, cfg)
    H, offset = to_ising(qp)

    total_states = 1 << n
    for state_int in range(total_states):
        x = [(state_int >> i) & 1 for i in range(n)]

        # 1. Direct classical energy evaluation
        e_direct = energy(sp, cfg, x)

        # 2. QuadraticProgram objective evaluation
        e_qubo = float(qp.objective.evaluate(x))

        # 3. Quantum state expectation value <x|H|x> + offset
        # Qiskit Statevector label has qubit 0 rightmost
        bitstring = assignment_to_bits(x)
        sv = Statevector.from_label(bitstring)
        e_ising = float(sv.expectation_value(H).real + offset)

        assert abs(e_direct - e_qubo) < 1e-9, f"QUBO mismatch at state {x}: {e_direct} vs {e_qubo}"
        assert abs(e_direct - e_ising) < 1e-9, f"Ising mismatch at state {x}: {e_direct} vs {e_ising}"


def test_qubo_with_lambda_cap_parity(subproblem_6: SubProblem):
    """Verify parity holds when capacity penalty lambda_cap > 0."""
    sp = subproblem_6
    cfg = QuantumConfig(backend="ideal", lambda_cap=15.0)
    n = len(sp.courses)

    qp = build_qubo(sp, cfg)
    H, offset = to_ising(qp)

    for state_int in range(1 << n):
        x = [(state_int >> i) & 1 for i in range(n)]
        e_direct = energy(sp, cfg, x)
        e_qubo = float(qp.objective.evaluate(x))

        bitstring = assignment_to_bits(x)
        sv = Statevector.from_label(bitstring)
        e_ising = float(sv.expectation_value(H).real + offset)

        assert abs(e_direct - e_qubo) < 1e-9
        assert abs(e_direct - e_ising) < 1e-9


def test_brute_force_matches_argmin_energy(subproblem_6: SubProblem):
    """Verify brute_force ground state equals true argmin of energy()."""
    sp = subproblem_6
    cfg = QuantumConfig(backend="ideal")
    n = len(sp.courses)

    bf = brute_force(sp, cfg)
    ground_x = bf["ground_x"]
    ground_energy = bf["ground_energy"]

    min_classical_energy = float("inf")
    for state_int in range(1 << n):
        x = [(state_int >> i) & 1 for i in range(n)]
        e = energy(sp, cfg, x)
        min_classical_energy = min(min_classical_energy, e)

    assert ground_energy == min_classical_energy
    assert energy(sp, cfg, ground_x) == ground_energy
    assert bf["max_energy"] >= ground_energy
    assert len(bf["energies"]) == (1 << n)
