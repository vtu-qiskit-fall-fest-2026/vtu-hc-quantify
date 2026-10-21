# PRD: QUANTA

## Problem
University exam timetabling is NP-hard: assign hundreds of exams to slots and rooms with hard constraints (no student with two exams in one slot, room capacity, no room double-booking) and soft goals (spacing, no back-to-back, minimal travel). Classical solvers find feasible schedules but dense interdisciplinary elective clusters make soft-constraint trade-offs slow to explore. Pure-quantum approaches do not scale on NISQ hardware and emit infeasible bitstrings.

## Solution
Hybrid by design: OR-Tools CP-SAT solves the whole schedule (feasible, certified). We extract only the dense bottleneck cluster (<= 14 courses), encode it as a QUBO with 1 qubit per course, run QAOA, then decode, repair, validate and either accept the improvement or fall back to the baseline. A built-in benchmark compares CP-SAT, brute force, simulated annealing, ideal QAOA, noisy QAOA and a real IBM QPU run.

## Users
1. **Examination Officer** (Dr. Aris Thorne): uploads data, gets a certified schedule, resolves clusters, publishes.
2. **Quantum/Optimization Researcher**: configures backend, p, optimizer, penalties; reads telemetry and benchmarks.
Students and faculty only consume exports.

## Scenario (demo spine)
4,200 students, 180 courses, 22 rooms, 5 days x 3 slots. Baseline solve time is whatever we measure (report the real number). A 12-course elective cluster affects ~110 students with back-to-back papers. Aris clicks "Optimize cluster", watches the pipeline, and sees an accepted or safely rejected result.

## Scope tiers (36 h)
### Must (core MVP, freeze at H32)
1. CSV ingestion + validation
2. CP-SAT baseline, 0 hard violations, independent scorer
3. Bottleneck extractor (8-14 courses, 2 candidate slots each)
4. QUBO + Ising + brute-force oracle
5. QAOA p in {1,2}, COBYLA (SPSA optional), ideal simulator
6. Repair + validation + fallback (the safety guarantee)
7. Benchmark engine and table (10 seeded clusters)
8. Web UI: Dataset, Timetable, Cluster Lab, Benchmarks
9. One real IBM QPU run saved and shown

### Should (only after Must is green)
Noise sweep chart, penalty sliders with live re-score, light theme/print export, role toggle.

### Roadmap (slide only, do not build)
Warm-start QAOA, XY/subspace mixers, dynamic re-scheduling, Celery/Redis/Postgres/JWT, multi-campus travel optimization.

## Success metrics
- Hard violations in any published schedule: 0
- Baseline solve time on the 180-course set: measured and reported
- QAOA approximation ratio vs brute force on 12-qubit clusters: reported honestly (mean, std, 10 seeds)
- Fallback triggers correctly on a forged bad candidate (test)
- Demo path runs 3 times in a row unassisted

## Non-goals
Claiming quantum advantage; student-facing UI; real-time rescheduling; auth beyond a role toggle.

## Definition of done
See `docs/PLAN_36H.md`, section "Freeze checklist".
