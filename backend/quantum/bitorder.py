"""Qiskit little-endian bitstring normalization helpers.

In Qiskit, measurement bitstrings are little-endian:
the rightmost character represents qubit 0.
"""
from __future__ import annotations


def bits_to_assignment(bitstring: str) -> list[int]:
    """Converts a raw Qiskit measurement bitstring to [x_0, x_1, ..., x_{n-1}].
    Where x_i represents the assignment for course i (qubit i).
    """
    return [int(ch) for ch in reversed(bitstring.strip())]


def assignment_to_bits(x: list[int]) -> str:
    """Converts [x_0, x_1, ..., x_{n-1}] back into a raw Qiskit bitstring."""
    return "".join(str(v) for v in reversed(x))
