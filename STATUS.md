# STATUS (update every 2-3 hours; owners tick their own lines)

Clock start (H0): ____  |  Freeze (H32): ____  |  Demo (H36): ____

## Tasks
### A: Classical + backend
- [x] A0 schemas + fixtures (H0-2)
- [x] A5a API mock mode (H2-3)  -> HO-01
- [x] A1 synthetic data generator
- [x] A2 CP-SAT baseline + independent scorer
- [x] A3 bottleneck extractor  -> HO-02
- [x] A4 repair + fallback
- [x] A5b real API wiring  -> HO-04
- [x] A6 integration fixes

### B: Quantum + benchmarks
- [x] B1 QUBO + Ising + brute force
- [x] B2 QAOA ideal runner + bit-order test
- [ ] B3 noisy simulation  
- [ ] B4 IBM runtime + fake backend  (first hardware job submitted by H20)
- [ ] B5 `run_quantum()` public interface -> HO-03
- [ ] B6 benchmark harness -> HO-05

### C: Frontend + demo
- [ ] C1 scaffold + design system
- [ ] C2 Dataset + Timetable pages (mock)
- [ ] C3 Cluster Lab
- [ ] C4 Benchmarks page
- [ ] C5 polish + demo docs
- [ ] C6 slides + recording

## Handoffs
- [x] HO-01 A->C mock API (H3)
- [x] HO-02 A->B subproblem fixtures (H3 tiny [delivered], H12 real)
- [ ] HO-03 B->A quantum interface (H14)
- [x] HO-04 A->C real API (H14)
- [ ] HO-05 B->C hardware + benchmarks (H28)
- [ ] HO-06 ALL freeze + demo readiness (H32)

## Known Issues & Hardening Audit (A6)
1. **QAOA Large-Cluster Decomposition**: Qiskit 2.x `QAOAAnsatz` single `.decompose()` leaves `PauliEvolutionGate` un-synthesized, causing `scipy.sparse.linalg.expm` `ArrayMemoryError` on 12-qubit clusters. Fully resolved via double-decomposition (`.decompose().decompose()`) to 1Q and 2Q gates, achieving ~0.5s execution for 12 qubits.
2. **Zero-Violation Integrity**: Audited all endpoints (`/runs/{id}`, `/runs/{id}/cache-load`, `/runs/{id}/publish`); hard violations strictly guaranteed at 0 with 500 error raised if violated.
3. **CP-SAT Scaling**: Profiled demo dataset (180 courses, 4200 students, 22 rooms, 15 slots); solves in 1.5 - 2.2s, well below the 60s threshold.

## Blockers
| Time | Who | Blocked on | Owner of fix | Resolved |
|---|---|---|---|---|

## Contract change votes
| Time | Change | A | B | C |
|---|---|---|---|---|

