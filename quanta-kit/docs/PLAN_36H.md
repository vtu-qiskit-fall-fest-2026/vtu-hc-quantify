# PLAN: 36 HOURS, 3 MEMBERS

## Roles
| | Member | Owns | Strengths needed |
|---|---|---|---|
| A | Classical + Backend lead | data, CP-SAT, scorer, extractor, repair, API, integration | Python, constraint modeling |
| B | Quantum + Benchmarks lead | QUBO, QAOA, noise, IBM, benchmark harness | Qiskit, numerics |
| C | Frontend + Demo lead | UI, design system, charts, demo, slides | React/TS, visual design |

## Timeline
| Hours | Phase | A | B | C | Exit checkpoint |
|---|---|---|---|---|---|
| H0-2 | Joint setup | schemas, fixtures, Makefile | IBM account + token, env check | repo, Vite scaffold | Contracts frozen, fixtures committed, AGENTS.md live |
| H2-3 | Unblock | **API mock mode** (HO-01) | start B1 | start C1 | C can fetch fixtures from `/api` |
| H3-12 | Build 1 | A1 datagen, A2 baseline, A3 extractor | B1 QUBO, B2 QAOA | C1 design system, C2 Dataset + Timetable | Baseline solves demo set; QAOA works on fixture |
| H12-14 | Integration 1 | real API (HO-04) | HO-02 consumed | switch off mock | Baseline timetable visible in real UI |
| H14-24 | Build 2 | A4 repair, A5b API quantum job | B3 noise, B4 IBM (**submit first QPU job by H20**), B5 `run_quantum` | C3 Cluster Lab | HO-03 done by H14, end-to-end on simulator by H24 |
| H24-28 | Integration 2 | fix, harden | B6 benchmarks | C4 Benchmarks page | Full flow works 3x on 180-course set |
| H28-32 | Hardware + polish | bug bash | hardware result into UI (HO-05) | C5 polish | Anti-generic checklist passes |
| **H32** | **FREEZE** | tag `v1` | | | `git tag v1`; fixes only |
| H32-36 | Demo | rehearse, backup recording | rehearse | slides, rehearse | 3 clean rehearsals, recording exists |

## Sleep plan
A sleeps H18-23, B sleeps H23-28, C sleeps H12-17 (API stable) and H28-30 if needed. Someone always owns integration. Nobody works past H34 without a 90-minute break.

## Rhythm
- Stand-up every 4 hours, 5 minutes: blocked? contract change? next handoff?
- Merge small and often (every 2-3 hours); branches `a/*`, `b/*`, `c/*`; `main` must always run `make test`.
- Update `STATUS.md` at every stand-up.

## Scope valve (when behind)
Cut in this order: noise sweep chart -> SPSA -> light theme -> department filter -> p=2 in UI (keep in benchmarks) -> simulated annealing baseline. Never cut: repair/fallback, independent scorer, real QPU run, honest benchmark table, Cluster Lab.

## Freeze checklist (H32)
- [ ] Upload dataset -> baseline with 0 hard violations
- [ ] Extract clusters -> run QAOA on simulator -> decision with reason
- [ ] Forged-bad-candidate test proves fallback
- [ ] One real IBM QPU run saved in `runs/hardware/` and visible in UI
- [ ] Benchmarks across 10 seeds, honest numbers
- [ ] Anti-generic checklist passes
- [ ] `make dev` starts everything from a clean clone; `.env.example` complete
- [ ] Demo path runs 3x unassisted; screen recording saved
- [ ] README has run instructions and honest claims section
