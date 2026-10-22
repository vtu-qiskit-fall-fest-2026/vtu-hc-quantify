"""Frozen Pydantic v2 data models for QUANTA.

Single source of truth for all data structures exchanged across backend,
quantum algorithms, classical solvers, and the frontend client.
Refer to docs/CONTRACTS.md.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Core Timetable & Constraint Models
# ---------------------------------------------------------------------------

class Assignment(BaseModel):
    """Assignment of an individual course exam to a slot and examination room(s)."""
    course_id: str
    slot_id: str
    room_ids: list[str]


class Timetable(BaseModel):
    """Complete examination timetable solution with certified constraint metrics."""
    run_id: str
    assignments: list[Assignment]
    hard_violations: int = 0
    soft_score: float = 0.0
    penalty_breakdown: dict[str, int] = Field(
        default_factory=lambda: {"back_to_back": 0, "three_in_day": 0, "two_in_day": 0}
    )
    solve_seconds: float = 0.0
    seed: int = 0


# ---------------------------------------------------------------------------
# Extracted Bottleneck Cluster & SubProblem Models
# ---------------------------------------------------------------------------

class PairWeight(BaseModel):
    """Weighted student conflict edge between two cluster courses."""
    a: str
    b: str
    shared_students: int


class FixedNeighbor(BaseModel):
    """External course outside the cluster with fixed slot assignment and shared students."""
    course_id: str
    slot_id: str
    shared_students: int


class SubProblem(BaseModel):
    """Compact bottleneck conflict subgraph mapped to binary candidate slots."""
    cluster_id: str
    courses: list[str]  # 4 <= len(courses) <= 14
    candidates: dict[str, tuple[str, str]]  # course_id -> (slotA, slotB)
    sizes: dict[str, int]  # course enrollment
    pair_weights: list[PairWeight]
    fixed_neighbors: list[FixedNeighbor]
    spare_capacity: dict[str, int]  # slot_id -> remaining seats
    slot_meta: dict[str, tuple[int, int]]  # slot_id -> (day, order)
    penalty_table: dict[str, float] = Field(
        default_factory=lambda: {
            "same_slot": 1000.0,
            "adjacent_same_day": 10.0,
            "same_day": 1.0,
            "none": 0.0,
        }
    )
    affected_students: int = 0
    baseline_cluster_cost: float = 0.0


# ---------------------------------------------------------------------------
# Quantum Algorithm & Runtime Models
# ---------------------------------------------------------------------------

class QuantumConfig(BaseModel):
    """Execution parameters for parameterized QAOA ansatz and hardware target."""
    backend: Literal["ideal", "noisy", "ibm", "fake_ibm"] = "ideal"
    p: Literal[1, 2] = 1
    optimizer: Literal["COBYLA", "SPSA"] = "COBYLA"
    shots: int = 4096
    seed: int = 7
    restarts: int = 5
    maxiter: int = 150
    lambda_cap: float = 0.0
    noise_scale: float = 1.0
    penalty_overrides: dict[str, float] = Field(default_factory=dict)


class BitstringCount(BaseModel):
    """Sampled bitstring measurement with normalized little-endian order and energy."""
    bits: str  # bits[i] is course i of subproblem.courses
    count: int
    energy: float


class QuantumResult(BaseModel):
    """Telemetry, energy convergence, and sampled bitstrings from quantum execution."""
    backend: str
    backend_detail: str
    p: int
    shots: int
    params: list[float]
    energy_history: list[float]
    top_bitstrings: list[BitstringCount]  # top 32 by count
    ground_energy: float | None = None
    best_sampled_energy: float = 0.0
    approx_ratio: float | None = None
    depth: int = 0
    two_qubit_gates: int = 0
    transpile_seconds: float = 0.0
    run_seconds: float = 0.0
    queue_seconds: float | None = None
    job_id: str | None = None
    noise_scale: float | None = None


# ---------------------------------------------------------------------------
# Classical Repair Gate & Acceptance Decision
# ---------------------------------------------------------------------------

class FinalDecision(BaseModel):
    """Authoritative acceptance or fallback decision for the quantum-refined candidate."""
    cluster_id: str
    source: Literal["quantum_repaired", "baseline_fallback"]
    before_score: float
    after_score: float
    resolved_students: int
    hard_violations: int = 0  # MUST always be 0
    changes: list[tuple[str, str, str]]  # (course_id, from_slot, to_slot)
    feasible_fraction: float  # share of top-K bitstrings feasible after repair
    reason: str  # plain English explanation displayed in UI


# ---------------------------------------------------------------------------
# Benchmarks & Async Job Management
# ---------------------------------------------------------------------------

class BenchmarkRow(BaseModel):
    """Single benchmark comparison record across solvers and problem seeds."""
    cluster_size: int
    seed: int
    method: str  # brute_force | cpsat | sim_anneal | qaoa_ideal_p1 | qaoa_ideal_p2 | qaoa_noisy_p1 | qaoa_ibm
    objective: float
    approx_ratio: float | None = None
    feasible_pct: float = 0.0
    runtime_s: float = 0.0
    depth: int | None = None
    two_qubit_gates: int | None = None
    failed: bool = False


class Job(BaseModel):
    """Asynchronous background job state and telemetry."""
    job_id: str
    kind: str
    status: Literal["queued", "running", "done", "error"]
    stage: str
    progress: float = 0.0
    energy_trace: list[float] = Field(default_factory=list)
    result_ref: str | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# Input Dataset Raw Schemas
# ---------------------------------------------------------------------------

class Course(BaseModel):
    course_id: str
    name: str = ""
    dept: str = "General"
    duration_min: int = 120


class Enrollment(BaseModel):
    student_id: str
    course_id: str


class Room(BaseModel):
    room_id: str
    building: str = "Main"
    capacity: int


class Slot(BaseModel):
    slot_id: str
    day: int
    start: str = "09:00"
    end: str = ""
    order: int


class Dataset(BaseModel):
    """Structured in-memory campus dataset."""
    courses: list[Course]
    enrollments: list[Enrollment]
    rooms: list[Room]
    slots: list[Slot]
