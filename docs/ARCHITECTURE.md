# ARCHITECTURE (lean, 36-hour build)

## Diagram
```
React + Vite + TS (C)  --REST + 1s polling-->  FastAPI (A)
                                                  |
            +-------------------------------------+----------------+
            |                                                      |
 backend/core (A)                                          SQLite + runs/*.json
  load -> CP-SAT baseline -> independent scorer
  -> extractor -> SubProblem
                     |
            backend/quantum (B)  run_quantum(subproblem, cfg, progress_cb)
              QUBO -> Ising -> QAOA
               |- ideal      (StatevectorEstimator / Sampler)
               |- noisy      (Aer NoiseModel + SamplerV2)
               |- ibm        (QiskitRuntimeService, SamplerV2, least_busy)
               |- fake_ibm   (FakeBackend, offline path test)
              -> QuantumResult
                     |
 backend/core/repair (A): decode -> validate (scorer + CP-SAT fixed-slot check)
   -> repair -> decide() -> FinalDecision  (accept or baseline_fallback)
```

## Layers and tech (what we actually build)
| Layer | Tech | Owner |
|---|---|---|
| UI | React 18, Vite, TypeScript, Tailwind, TanStack Table, Recharts, d3-force, papaparse | C |
| API | FastAPI, Uvicorn, pydantic v2, BackgroundTasks | A |
| Store | SQLite (SQLAlchemy 2.0) for jobs; JSON files under `runs/` for results | A |
| Classical | ortools CP-SAT, networkx, numpy, pandas, scipy | A |
| Quantum | qiskit 2.x, qiskit-optimization, qiskit-aer, qiskit-ibm-runtime, scipy | B |

## Cut for hackathon, kept as roadmap
Celery + Redis (replaced by BackgroundTasks + SQLite job table), PostgreSQL/Supabase, JWT auth (replaced by a `X-Role: coordinator|researcher` header), Next.js (Vite is faster to boot), AG Grid (TanStack is enough).

## Key design decisions
1. **Candidate-slot encoding.** Each cluster course has exactly two candidate slots (current A, best alternative B). One qubit per course. No one-hot penalties. See `QUBO_SPEC.md`.
2. **Quantum never touches feasibility.** Capacity and room assignment are validated classically after decoding. Quantum proposes, classical disposes.
3. **Optimize offline, sample on hardware.** QAOA parameters are tuned on the ideal simulator; hardware only runs the sampler with those parameters. Saves queue quota.
4. **Independent scorer.** `score_timetable()` is pure Python and does not use CP-SAT, so it can audit any timetable, including the solver's own.
5. **Mock mode.** `QUANTA_MOCK=1` serves fixtures so C never waits for A or B.
6. **Everything cached.** Results land in `runs/<run_id>/` so the demo never depends on live compute.

## Folder layout
```
quanta/
  AGENTS.md CLAUDE.md STATUS.md README.md .env.example Makefile requirements.txt
  backend/
    schemas.py
    core/   datagen.py baseline.py scorer.py extractor.py repair.py
    quantum/ qubo.py qaoa.py noise.py ibm.py bitorder.py interface.py
    api/    main.py jobs.py db.py
    tests/
  benchmarks/ run_benchmarks.py results.csv figs/
  data/ synthetic/ fixtures/
  runs/ <run_id>/ hardware/
  frontend/ src/{pages,components,api.ts,types.ts,theme.css}
  docs/ tasks/ handoffs/
```

## Runtime flow (happy path)
1. UI uploads 4 CSVs -> `POST /datasets` -> dataset_id
2. `POST /runs/{id}/baseline` -> job -> Timetable (0 hard violations)
3. `POST /runs/{id}/clusters/extract` -> ranked SubProblems
4. `POST /runs/{id}/clusters/{cid}/quantum` -> job; progress polled via `GET /jobs/{job_id}`
5. Worker: run_quantum -> decode top-K bitstrings -> repair -> decide -> FinalDecision stored
6. UI shows before/after, decision text, histogram; Benchmarks page reads `/runs/{id}/benchmarks`

## Makefile targets (A creates at H1)
`make setup` (venv + pip + npm), `make dev` (API :8000 + UI :5173), `make test`, `make mock` (QUANTA_MOCK=1), `make data` (generate demo dataset), `make bench`.
