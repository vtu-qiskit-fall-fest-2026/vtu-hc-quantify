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
- [ ] A5b real API wiring  -> HO-04
- [ ] A6 integration fixes

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
- [ ] HO-04 A->C real API (H14)
- [ ] HO-05 B->C hardware + benchmarks (H28)
- [ ] HO-06 ALL freeze + demo readiness (H32)

## Blockers
| Time | Who | Blocked on | Owner of fix | Resolved |
|---|---|---|---|---|

## Contract change votes
| Time | Change | A | B | C |
|---|---|---|---|---|
