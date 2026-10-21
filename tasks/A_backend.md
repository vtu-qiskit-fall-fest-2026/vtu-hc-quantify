# MEMBER A: Classical core + backend

Agent: Claude Code (terminal) recommended. Load `AGENTS.md`. One task per session. Paste the prompt, then answer with "go" after reviewing its 5-bullet plan.

Owned: `backend/core/`, `backend/api/`, `data/`, `Makefile`, `requirements.txt`, `.env.example`.

---
## A0 (H0-2): schemas, fixtures, Makefile
**Deliver:** `backend/schemas.py`, `data/fixtures/*`, `Makefile`, `requirements.txt`, `.env.example`, `docs/api.md` stub.
**Prompt:**
```
Read docs/CONTRACTS.md fully. Create backend/schemas.py with pydantic v2 models exactly as specified in section 2 (Assignment, Timetable, PairWeight, FixedNeighbor, SubProblem, QuantumConfig, BitstringCount, QuantumResult, FinalDecision, BenchmarkRow, Job) plus Dataset (courses, enrollments, rooms, slots as typed lists with helper indexes). Then hand-build data/fixtures/mini/ (12 courses, 60 students, 4 rooms, 8 slots over 2 days, with one dense 6-course elective cluster where about 15 students sit consecutive exams in the naive timetable) and the fixture JSON files listed in CONTRACTS section 6; fixture values must be internally consistent (the quantum_result must match subproblem_6 and the decision must match the quantum_result). Write tests/test_schemas.py that loads and validates every fixture. Create a Makefile with targets setup, dev, test, mock, data, bench (frontend commands may be placeholders only if the frontend folder does not exist yet, and say so). Create requirements.txt with unpinned: ortools networkx scipy numpy pandas qiskit qiskit-optimization qiskit-aer qiskit-ibm-runtime fastapi uvicorn[standard] pydantic sqlalchemy python-multipart pytest ruff matplotlib. Run pip install, then pip freeze > requirements.lock. Run the tests and show output.
```
**Done when:** `make test` green; everyone can `import backend.schemas`.

---
## A5a (H2-3): API mock mode  (triggers HO-01)
**Prompt:**
```
Build backend/api/main.py (FastAPI) implementing every endpoint in docs/CONTRACTS.md section 3, with pydantic response models and CORS for http://localhost:5173. When env QUANTA_MOCK=1, every endpoint serves data from data/fixtures/ instantly; jobs complete in 3 seconds of simulated progress (stage names qubo, ising, circuit, optimize, sample, repair, decide; energy_trace grows each poll using values from fixtures/quantum_result.json). Support header X-Role (default coordinator): backend 'ibm' or 'noisy' in a quantum request returns 403 with a human-readable error when the role is coordinator. Add GET /health. Store job state in an in-memory dict for now (SQLite later). Export the OpenAPI schema to docs/api.md (endpoint, method, request, response). Tests: tests/test_api_mock.py using TestClient covering health, upload, baseline job lifecycle, extract, quantum job, role 403. Add `make mock`. Show curl examples for 3 endpoints.
```

---
## A1 (H3-6): synthetic data generator
**Prompt:**
```
In backend/core/datagen.py write generate_dataset(n_students, n_courses, n_rooms, n_days, slots_per_day, seed, name) that writes the four CSVs defined in docs/CONTRACTS.md section 1 to data/synthetic/<name>/. Realism: 8 departments; each student takes 5-6 courses: 4 from their home department core pool and 1-2 cross-faculty electives drawn from a Zipf-like distribution so a handful of popular electives (e.g. Financial Mathematics, Bio-ethics, Intro to AI) create dense overlapping groups; durations 120 or 180 minutes; room capacities between 40 and 400 with total capacity per slot at least 1.3x the largest slot load needed; slots numbered with a global 'order' and 'day'. Add a CLI: python -m backend.core.datagen --preset demo (4200 students, 180 courses, 22 rooms, 5 days, 3 slots/day) and --preset mini. Wire `make data`. Tests: deterministic by seed; no student has duplicate courses; the top 12 electives share at least 100 students pairwise-connected overall; the demo preset is feasible by a quick capacity check. Print summary statistics (density of conflict graph, max overlap).
```

## A2 (H5-9): CP-SAT baseline and independent scorer
**Prompt:**
```
Implement backend/core/baseline.py and backend/core/scorer.py per docs/CONTRACTS.md section 4.
scorer.py: score_timetable(ds, tt) in pure Python (must NOT import ortools). It recomputes: hard violations = student clashes (two exams same slot), slot capacity overflow (sum of enrollment in slot vs total capacity of rooms assigned to that slot), room double-booking, unassigned exams. Soft score = 10 * (student-instances with back-to-back exams in adjacent slots same day) + 3 * (students with 3+ exams in a day) + 1 * (student-days with 2 exams). Put weights in a frozen dataclass ScoreWeights. Fill penalty_breakdown.
baseline.py: solve_baseline(ds, time_limit_s=60, seed=0) -> Timetable. CP-SAT model: boolean x[e,s]; each exam in exactly one slot; for every student and slot at most one exam; per-slot enrollment total <= total room capacity; soft objective via auxiliary booleans for back-to-back pairs per conflicting course pair (use conflict-pair counts weighted by shared students, not per-student variables, to keep the model small). Then a second stage assigns rooms per slot: best-fit decreasing, splitting exams across rooms when needed, verified by the scorer. Set num_workers=8, random_seed, and log solve time. Add a hint of a greedy graph-coloring solution to speed up. Tests: fixture is feasible with 0 hard violations; scorer's soft score equals the solver objective on the fixture; scorer detects an injected clash, an injected capacity overflow, and a double-booked room; the demo preset is solved with 0 hard violations within the time limit (mark slow test with pytest.mark.slow). Report measured solve time for the demo preset.
```

## A3 (H9-12): bottleneck extractor  (triggers HO-02 real)
**Prompt:**
```
Implement backend/core/extractor.py: extract_clusters(ds, tt, max_size=12, top_k=5) -> list[SubProblem].
Steps: (1) build a networkx graph with courses as nodes and shared-student counts as edge weights; (2) compute per-edge penalty weight from the baseline (edges whose two courses sit in adjacent same-day slots or same day get weight shared_students * pen); (3) find dense clusters: iteratively seed from the highest-penalty edge, grow greedily by adding the neighbor with the highest total penalized weight to the cluster until max_size, then rank clusters by total penalized student count, enforce no more than 50% overlap between returned clusters; (4) for each cluster course compute candidate slot B = the slot (different from current) that minimizes added cost against cluster-external neighbors, subject to spare capacity in that slot being >= the course's enrollment (use spare_capacity computed excluding cluster courses); skip slots creating a hard clash with fixed neighbors; if no valid B exists drop the course from the cluster; (5) fill sizes, pair_weights, fixed_neighbors, spare_capacity, slot_meta, penalty_table defaults, affected_students, baseline_cluster_cost. Hard cap len(courses) <= 14 and min 4. Tests on fixtures and the mini dataset: size bounds; candidates always two distinct slots; candidate B never creates a hard clash with fixed neighbors; deterministic; baseline_cluster_cost equals the QUBO energy of the all-zeros assignment (compute with a tiny local energy function in the test and mirror the formula in docs/QUBO_SPEC.md). Also write data/fixtures/subproblem_12.json from the demo dataset and report the top 3 clusters' sizes and affected students.
```

## A4 (H14-20): repair and fallback
**Prompt:**
```
Implement backend/core/repair.py per docs/CONTRACTS.md section 4 and docs/QUBO_SPEC.md section 10.
decode(sp, bits): bits[i] is course i (already normalized); x=1 means course moves to candidate B.
validate(ds, tt, changes): apply changes to a copy of the timetable; return a list of human-readable hard-violation strings using score_timetable plus a CP-SAT feasibility call with only room assignment free for the changed slots (all exam-slot variables fixed). Empty list means feasible.
repair(ds, tt, sp, bits): while violations exist, flip back to slot A the changed course whose reversal yields the lowest cost increase (ties by smaller enrollment), up to len(courses) flips; return None if still infeasible.
decide(ds, tt, sp, qr): take the top 32 bitstrings by count, decode, validate, repair; compute the new soft score with the independent scorer; pick the candidate with strictly lowest soft score below baseline and hard_violations == 0; else return FinalDecision(source='baseline_fallback') with before==after and a plain-English reason (e.g. 'Best repaired candidate scored 412 vs baseline 405; kept baseline'). Fill resolved_students, changes, feasible_fraction.
Tests: a forged all-ones bitstring that creates a capacity overflow is repaired or rejected; forged QuantumResult with only infeasible bitstrings yields baseline_fallback; decide never returns hard_violations > 0 (property-style test with 200 random bitstrings); accepted decision on the fixture matches fixtures/decision_accepted.json semantics.
```

## A5b (H12-14, H20-28): real API wiring  (triggers HO-04)
**Prompt:**
```
Replace mock-only behavior in backend/api/ with the real pipeline while keeping QUANTA_MOCK=1 working. Jobs: SQLAlchemy 2.0 SQLite table jobs(job_id, kind, status, stage, progress, energy_trace_json, result_ref, error, created_at); run work with FastAPI BackgroundTasks in a ThreadPoolExecutor; progress_cb updates stage/progress/energy_trace. Endpoints: POST /datasets validates CSVs (return warnings, not 500s), POST /runs, baseline job -> saves runs/<id>/baseline.json, extract -> clusters.json, quantum job -> calls backend.quantum.interface.run_quantum (import lazily; if B's module is missing return a clear 501 error), then decide() and store both QuantumResult and FinalDecision, publish re-verifies 0 violations with the scorer before returning the export. Role rules per contracts. Errors use {error:{code,message}}. Add GET /runs/{id}/benchmarks reading benchmarks/results.csv and runs/hardware/*.json. Add a CLI script scripts/e2e.py that runs the entire pipeline headlessly on the mini dataset with backend=ideal and prints the FinalDecision; make it part of `make test`.
```

## A6 (H24-32): integration and hardening
**Prompt:**
```
Run scripts/e2e.py on the demo dataset 3 times with different seeds. Fix any crash. Add request logging, timing logs per stage, and a /runs/{id}/cache-load endpoint that restores a cached run for demo. Profile the baseline on the demo dataset; if it exceeds 60 s add a time-limit hint and report the best bound. Audit that no endpoint can return a timetable with hard_violations > 0. Update docs/api.md. List remaining known issues in STATUS.md.
```
