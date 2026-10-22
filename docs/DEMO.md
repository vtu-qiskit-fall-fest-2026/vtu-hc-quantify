# DEMO SCRIPT & REHEARSAL PLAYBOOK (Owner: Member C — Yash Koparde)

> **Team**: Quantify (VTU-QFF-HC-0076)  
> **System**: QUANTA — IBM Quantum-Assisted Timetabling Platform  
> **Measured Hardware Execution**: `ibm_kingston` (Job: `dbcfb3vi0auc73durnc0`, 156Q, 65 Depth, 20 2Q Gates)

---

## ⏱️ 4-Minute Presentation Script & Click Paths

| Time | Screen | Say (Verbatim / Under 2 Sentences) | Click Path |
|---|---|---|---|
| **0:00 - 0:30** | **Slide 1 & 2**: Problem & Why Hybrid | *"University exam timetabling is an NP-hard combinatorial problem where dense elective overlaps cause severe student fatigue. Pure quantum can never scale to campus size and violates hard constraints, while pure classical methods get trapped in dense local trade-offs."* | Show Slide 1, then transition to Slide 2 (Competitor Matrix). |
| **0:30 - 0:50** | **Slide 3**: Architecture | *"QUANTA uses a hybrid architecture: OR-Tools CP-SAT solves the global campus with certified zero violations, graph bottleneck extraction isolates a compact subproblem, and Qiskit QAOA optimizes it with classical repair and fallback safety gates."* | Show Slide 3 (CP-SAT -> Extractor -> QAOA -> Repair -> Safety Gate). |
| **0:50 - 1:15** | **Dataset Page** (`/`) | *"Here we ingest 4 CSV files representing 60 students, 12 courses, and 8 slots. Client-side audits verify no duplicate enrollments, slot order continuity, and room capacity constraints."* | Click **'Load Demo Fixtures'** -> View Clean Ingestion Manifest -> Click **'Solve Baseline'**. |
| **1:15 - 1:40** | **Timetable Page** (`/timetable`) | *"CP-SAT computed the global feasible baseline in 1.42 seconds with exactly 0 hard violations, but students still suffer 16 back-to-back testing clashes across Day 1 and Day 2."* | Observe top status bar `Solved in 1.4 s, 0 hard violations`. Click course block `CRS001` to show Coupled Conflict Courses panel. |
| **1:40 - 2:05** | **Cluster Lab** (`/clusters`) | *"The bottleneck extractor isolated cluster `cluster_01` with 6 coupled courses and 31 affected students. The force-directed graph visualizes conflict edges weighted by shared students, color-coded by exam time slot."* | Click `g c` (or rail icon) -> Select `cluster_01` in left rail -> Point to center conflict graph. |
| **2:05 - 2:40** | **QAOA Run & Convergence** (`/clusters`) | *"We map the subproblem to a 6-qubit QUBO with 1 binary variable per course. Running QAOA depth p=1 with COBYLA, the expectation energy converges from 182.0 down to 118.0."* | Set Backend: `Simulator`, `p=1`, `COBYLA`, `4096 shots` -> Click **'Run QAOA Pipeline (r)'** -> Watch live Stepper & Recharts energy curve converge. |
| **2:40 - 3:05** | **Gate Decision & Resolution** (`/clusters`) | *"The classical repair gate verified 0 clashes and accepted the quantum candidate: 'Accepted: Soft penalty reduced from 182.0 to 118.0 (-64.0). Resolved back-to-back clashes for 12 students with 0 hard violations.' Click Publish to apply."* | Toggle **Before / After** Segmented (animating node fill colors) -> Click **'Publish Resolution'** -> Observe success toast. |
| **3:05 - 3:40** | **Benchmarks & Hardware** (`/benchmarks`) | *"On our empirical benchmark suite across 10 seeds, QAOA reached 84% to 100% of the optimum. Crucially, on physical 156-qubit IBM Kingston hardware, our transpiled circuit achieved depth 65 and 20 two-qubit gates, achieving exact ground energy parity."* | Click `g b` -> Point to **Honest Summary Banner** -> Open **IBM Hardware Run Card** -> Click **'View Raw Telemetry JSON'**. |
| **3:40 - 4:00** | **Slide 6**: Roadmap & Conclusion | *"QUANTA proves that NISQ quantum computing delivers real value today when embedded inside a provably safe classical harness. Next: warm-start QAOA, subspace mixers, and dynamic campus rescheduling."* | Transition to Slide 6 -> Wrap presentation. |

---

## 🛡️ Three Most Likely Failure Points & Recovery Actions

### Failure Point 1: Live API Backend Connection / Network Drop
- **Root Cause**: Python backend process crashes or local port `:8000` is blocked.
- **Immediate Recovery Action**:
  1. The frontend features an instant built-in fallback and client-side demo loader: click **'Load Demo Fixtures'** on the Dataset page to immediately simulate and proceed.
  2. If the API is offline, the UI surfaces clear server error toasts rather than crashing, and the cached benchmark and hardware telemetry run (`runs/hardware/20261021_172544.json`) remains fully accessible via the UI.

### Failure Point 2: IBM Quantum Hardware Queue Delay During Live Presentation
- **Root Cause**: Public IBM Quantum cloud queues can spike to hours during peak hackathon hours.
- **Immediate Recovery Action**:
  1. Select **'Simulator'** backend for the live 3-second interactive demonstration in Cluster Lab.
  2. For hardware verification, switch to the **Benchmarks** page (`/benchmarks`): showcase the completed execution on `ibm_kingston` (Job ID: `dbcfb3vi0auc73durnc0`), which was physically executed and saved on disk. Never pretend a live QPU run was instantaneous; judges respect honest engineering.

### Failure Point 3: Accidental Browser Refresh or State Desynchronization
- **Root Cause**: Presenter hits Cmd/Ctrl+R or browser tab resets.
- **Immediate Recovery Action**:
  1. The top navigation bar and all pages automatically reload default fixture states from `/api/runs/run_fixture_mini` on mount.
  2. Simply use the keyboard shortcut `g t` or `g c` to jump directly back to the Timetable or Cluster Lab without restarting the dataset upload sequence.

---

## 📋 Pre-Demo Technical Checklist
- [x] Backend running in mock mode: `QUANTA_MOCK=1 python -m backend.api.main` on `:8000`
- [x] Frontend running: `npm run dev` or production build preview on `:5173`
- [x] Fonts bundled locally via `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` (zero CDN dependencies)
- [x] Hardware telemetry verified: `runs/hardware/20261021_172544.json` present on disk
- [x] Browser zoom set to 110% on 1920x1080 display
- [x] Full 4-minute demo path rehearsed 3 consecutive times with clean pass
