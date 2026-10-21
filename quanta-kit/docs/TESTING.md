# TESTING

## Principles
Fast (<5 s per module on fixtures), deterministic (seeds), independent verification (scorer does not use CP-SAT, brute force does not use QAOA).

## Required tests by owner
### A
- `test_schemas`: every fixture validates.
- `test_datagen`: deterministic by seed; no duplicate (student, course); hotspot electives have high overlap.
- `test_baseline`: fixture feasible; `score_timetable` recomputation equals solver's reported objective; 0 hard violations; demo set solves within its time limit.
- `test_scorer_catches`: hand-made timetable with a clash, a capacity overflow and a double-booked room each reported.
- `test_extractor`: cluster size <= 14; every course has two distinct candidate slots; fixed neighbors consistent with baseline.
- `test_repair`: forged clashing bitstring -> repaired or rejected; `decide()` returns baseline unchanged when nothing improves; `hard_violations == 0` always.
- `test_api`: mock mode returns fixtures; role header blocks `ibm` for coordinator (403); job lifecycle queued -> running -> done.

### B
- `test_ising_equivalence`: all states, both fixtures.
- `test_bitorder`: described in QUBO_SPEC section 6.
- `test_qaoa_p1_ratio`: >= 0.85 on 6 qubits, seed fixed.
- `test_run_quantum_fake_ibm`: valid QuantumResult in < 60 s.
- `test_no_ortools_import` in `backend/quantum`.

### C
- `tsc --noEmit` clean; Vitest for the CSV validator and API client; Playwright smoke (optional): load app in mock mode, upload fixture, click through four pages with no console errors.

## End-to-end acceptance (all, at H24 and H32)
1. `make data` creates the 180-course dataset.
2. UI: upload -> baseline -> extract -> run cluster (ideal) -> decision displayed.
3. Same with `fake_ibm`.
4. Forced-fallback demo: set penalty overrides so QAOA cannot improve; UI shows "kept baseline" with reason.
5. Benchmarks page renders from `benchmarks/results.csv` with no placeholder values.
6. Kill network: demo still works from cached `runs/`.
