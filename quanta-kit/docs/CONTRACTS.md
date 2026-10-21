# CONTRACTS (frozen at H2; change only by 3-way vote logged in STATUS.md)

Source of truth in code: `backend/schemas.py` (pydantic v2). TypeScript mirror: `frontend/src/types.ts`. If this file and the code disagree, fix the code to match this file.

## 1. Input CSVs
| File | Columns |
|---|---|
| `courses.csv` | course_id, name, dept, duration_min |
| `enrollments.csv` | student_id, course_id |
| `rooms.csv` | room_id, building, capacity |
| `slots.csv` | slot_id, day (int 0-based), start (HH:MM), end (HH:MM), order (int, global chronological index) |

Validation: no duplicate (student, course); every course in enrollments exists; slot `order` unique and increasing; adjacent = same `day` and `order` differs by 1.

## 2. Models (pydantic, fields and types)
```python
class Assignment(BaseModel):  course_id: str; slot_id: str; room_ids: list[str]
class Timetable(BaseModel):
    run_id: str; assignments: list[Assignment]
    hard_violations: int; soft_score: float
    penalty_breakdown: dict[str, int]   # back_to_back, three_in_day, two_in_day (student counts)
    solve_seconds: float; seed: int

class PairWeight(BaseModel):  a: str; b: str; shared_students: int
class FixedNeighbor(BaseModel): course_id: str; slot_id: str; shared_students: int   # course outside cluster, fixed
class SubProblem(BaseModel):
    cluster_id: str; courses: list[str]                      # len 4..14
    candidates: dict[str, tuple[str, str]]                   # course -> (slotA, slotB), distinct; A = current
    sizes: dict[str, int]                                    # enrollment per course
    pair_weights: list[PairWeight]
    fixed_neighbors: list[FixedNeighbor]
    spare_capacity: dict[str, int]                           # slot_id -> spare seats excluding cluster courses
    slot_meta: dict[str, tuple[int, int]]                    # slot_id -> (day, order)
    penalty_table: dict[str, float]  # same_slot=1000, adjacent_same_day=10, same_day=1, none=0
    affected_students: int; baseline_cluster_cost: float

class QuantumConfig(BaseModel):
    backend: Literal['ideal','noisy','ibm','fake_ibm']
    p: Literal[1,2] = 1; optimizer: Literal['COBYLA','SPSA'] = 'COBYLA'
    shots: int = 4096; seed: int = 7; restarts: int = 5; maxiter: int = 150
    lambda_cap: float = 0.0; noise_scale: float = 1.0
    penalty_overrides: dict[str, float] = {}

class BitstringCount(BaseModel): bits: str; count: int; energy: float   # bits already normalized: bits[i] is course i of subproblem.courses
class QuantumResult(BaseModel):
    backend: str; backend_detail: str; p: int; shots: int
    params: list[float]; energy_history: list[float]
    top_bitstrings: list[BitstringCount]                     # top 32 by count
    ground_energy: float | None; best_sampled_energy: float; approx_ratio: float | None
    depth: int; two_qubit_gates: int; transpile_seconds: float; run_seconds: float
    queue_seconds: float | None; job_id: str | None; noise_scale: float | None

class FinalDecision(BaseModel):
    cluster_id: str; source: Literal['quantum_repaired','baseline_fallback']
    before_score: float; after_score: float; resolved_students: int
    hard_violations: int          # MUST be 0
    changes: list[tuple[str, str, str]]   # (course, from_slot, to_slot)
    feasible_fraction: float      # share of top-K bitstrings feasible after repair
    reason: str                   # plain English, shown verbatim in UI

class BenchmarkRow(BaseModel):
    cluster_size: int; seed: int; method: str    # brute_force|cpsat|sim_anneal|qaoa_ideal_p1|qaoa_ideal_p2|qaoa_noisy_p1|qaoa_ibm
    objective: float; approx_ratio: float | None; feasible_pct: float
    runtime_s: float; depth: int | None; two_qubit_gates: int | None; failed: bool

class Job(BaseModel):
    job_id: str; kind: str; status: Literal['queued','running','done','error']
    stage: str; progress: float; energy_trace: list[float]; result_ref: str | None; error: str | None
```

## 3. REST API (base `/api`, JSON, header `X-Role: coordinator|researcher`)
| Method + path | Body | Returns |
|---|---|---|
| `GET /health` | | `{status, mock, version}` |
| `POST /datasets` | multipart 4 CSVs | `{dataset_id, stats, warnings[]}` |
| `POST /runs` | `{dataset_id, seed?}` | `{run_id}` |
| `POST /runs/{id}/baseline` | `{time_limit_s?}` | `Job` |
| `GET /runs/{id}` | | `{run, timetable?, clusters?, decisions[]}` |
| `POST /runs/{id}/clusters/extract` | `{max_size?, top_k?}` | `SubProblem[]` |
| `POST /runs/{id}/clusters/{cid}/quantum` | `QuantumConfig` (ibm/noisy only for researcher, else 403) | `Job` |
| `GET /jobs/{job_id}` | | `Job` |
| `GET /runs/{id}/clusters/{cid}/result` | | `{quantum: QuantumResult, decision: FinalDecision}` |
| `GET /runs/{id}/benchmarks` | | `{rows: BenchmarkRow[], hardware: object[], figures: string[]}` |
| `POST /runs/{id}/publish` | `{cluster_ids[]}` | `{timetable, export_url}` (applies accepted decisions; re-verifies 0 violations) |
| `GET /runs/{id}/export.csv` | | CSV |

Errors: `{error: {code, message}}` with HTTP 4xx/5xx. Messages are human readable and shown verbatim in the UI.

## 4. Module interfaces
```python
# backend/core/baseline.py
solve_baseline(ds: Dataset, time_limit_s: int = 60, seed: int = 0) -> Timetable
# backend/core/scorer.py  (no ortools import allowed)
score_timetable(ds: Dataset, tt: Timetable) -> Timetable   # recomputes violations and soft score
# backend/core/extractor.py
extract_clusters(ds, tt, max_size=12, top_k=5) -> list[SubProblem]
# backend/core/repair.py
decode(sp: SubProblem, bits: str) -> dict[str, str]                       # course -> slot
validate(ds, tt, changes: dict[str, str]) -> list[str]                    # [] means feasible
repair(ds, tt, sp, bits) -> dict[str, str] | None
decide(ds, tt, sp, qr: QuantumResult) -> FinalDecision
# backend/quantum/interface.py  (B's public entry point; A calls it)
run_quantum(sp: SubProblem, cfg: QuantumConfig, progress_cb: Callable[[str, float, float | None], None]) -> QuantumResult
# stages for progress_cb: 'qubo','ising','circuit','optimize','sample','transpile','queue','done'
```

## 5. File artifacts
`runs/<run_id>/{dataset.json, baseline.json, clusters.json, cluster_<cid>_quantum.json, cluster_<cid>_decision.json}`; hardware raw output at `runs/hardware/<UTC-timestamp>.json` (backend name, num_qubits, queue_seconds, depth, 2q gates, params, counts). Benchmarks at `benchmarks/results.csv` and `benchmarks/figs/*.png`.

## 6. Fixtures (A delivers at H2, in `data/fixtures/`)
`mini/` dataset (12 courses, 60 students, 4 rooms, 8 slots, 2 days, one dense 6-course elective cluster); `timetable.json`, `subproblem_6.json`, `subproblem_12.json`, `quantum_result.json`, `decision_accepted.json`, `decision_fallback.json`, `benchmarks.json`. Each validates against `schemas.py` in a test.
