# DEMO (owner: C; rehearse 3x)

## 4-minute script
| Time | Screen | Say (2 sentences max) | Click path |
|---|---|---|---|
| 0:00 | Slide: problem | "Exam timetabling is NP-hard and the pain is in dense elective clusters. Pure quantum can't scale and returns invalid bitstrings; pure classical stalls on trade-offs." | |
| 0:30 | Slide: architecture | "Classical solves the whole campus and certifies feasibility. Quantum only touches a 12-qubit bottleneck, and everything it returns is repaired and validated." | |
| 0:50 | Dataset | "4,200 students, 180 courses, 22 rooms." | Drop 4 CSVs -> Solve baseline |
| 1:10 | Timetable | "Baseline in [measured] seconds, zero hard violations. But [N] students still sit back-to-back papers." | Hover the day strip, open a block |
| 1:40 | Cluster Lab | "The extractor found a 12-course elective cluster affecting [N] students." | Select top cluster, show subgraph |
| 2:00 | Cluster Lab run | "QUBO with 12 binary variables, QAOA depth 1, COBYLA. Watch the energy converge." | Backend: Simulator -> Run |
| 2:40 | Decision | read the decision sentence verbatim | Toggle Before/After |
| 3:00 | Benchmarks | "10 seeded clusters: QAOA vs brute force, CP-SAT, simulated annealing. On real IBM hardware we saw [ratio] at depth [d] with [g] two-qubit gates." Be honest: no advantage claim. | Open IBM run card |
| 3:40 | Slide: roadmap | "Warm-start QAOA, subspace mixers, dynamic re-scheduling." | |

## Fallbacks
- IBM down/queued: show the saved `runs/hardware/<ts>.json` in the IBM run card; say it was executed earlier.
- Solver slow: pre-solved baseline cached in `runs/`; "Load cached run" button.
- Wi-Fi dead: everything is local except IBM; cached.
- UI crash: screen recording on desktop, `demo.mp4`.
- Judge asks "where's the quantum advantage?": "At 12 qubits we expect parity with classical. What we built is the safe integration layer and the benchmark harness that tells you when hardware starts to help."

## Likely Q&A
- Why 2 candidate slots? Keeps one qubit per course, no one-hot penalties, circuits that transpile at low depth.
- How do you guarantee feasibility? Independent scorer + CP-SAT fixed-slot validation + fallback; nothing unverified is publishable.
- What if repair fails? Baseline is deployed unchanged and the UI says why.
- Scaling? Cluster size is bounded; we decompose, so cost grows with number of clusters, not campus size.

## Slide outline (6)
1 Problem + pain; 2 Why hybrid (competitor matrix, 4 rows); 3 Architecture; 4 Live demo; 5 Benchmark honesty (table + noise sweep); 6 Roadmap + team.

## Pre-demo checklist
Laptop charged; two browser windows tested; fonts installed locally (no CDN dependency); `.env` present; cached run loaded; recording on desktop; Do Not Disturb on; zoom 110% for the room.
