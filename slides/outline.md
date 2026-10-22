# QUANTA Presentation Deck — 6-Slide Outline

> **Event**: VTU-QFF Hackathon — VTU-Qiskit Fall Fest 2026  
> **Team**: Quantify (VTU-QFF-HC-0076)  
> **Presenter**: Yash B Koparde (Team Lead / Member C)

---

## Slide 1: The Problem — University Examination Timetabling Under Bottlenecks

### Slide Content:
- **Challenge**: University timetabling is NP-hard. Assigning hundreds of courses across limited slots and rooms must satisfy hard constraints (no student clashes, room capacities) while minimizing soft penalties (back-to-back exam fatigue).
- **The Bottleneck**: Dense elective clusters where multi-department students take overlapping electives. Standalone classical heuristics get trapped in poor local minima, while pure quantum methods cannot scale to full campus datasets and output invalid bitstrings.
- **The Goal**: Guaranteed feasible schedules with targeted quantum optimization on the hardest conflict bottlenecks.

> **Speaker Notes (<40 words)**:  
> *"University exam scheduling is NP-hard. Full campus schedules fail on pure quantum due to qubit limits, while classical solvers stall on dense elective clusters. QUANTA solves this with a safe hybrid pipeline."*

---

## Slide 2: Why Hybrid? Architectural Comparison Matrix

### Slide Content:

| Dimension | Pure Classical (CP-SAT / MIP) | Pure Quantum (QAOA on QPU) | Genetic / Heuristic (SA / GA) | **QUANTA (Hybrid Decomposed)** |
|:---|:---:|:---:|:---:|:---:|
| **Hard Constraint Guarantee** | Certified 0 violations | Violations frequent | No guarantees | **Certified 0 violations (CP-SAT Gate)** |
| **Scalability to Campus** | Up to 10,000+ students | Fails > 20 courses | Moderate (slow convergence) | **Full campus classical + 12Q bottlenecks** |
| **NISQ Hardware Readiness** | N/A | Exceeds decoherence time | N/A | **Transpiles on 156Q IBM Kingston (depth 65)** |
| **Deployment Safety** | Safe | Unsafe for production | Unsafe | **Automated fallback safety gate** |

> **Speaker Notes (<40 words)**:  
> *"Pure quantum cannot enforce hard constraints at scale. Pure classical struggles with dense elective trade-offs. QUANTA delivers certified 0-violation schedules with quantum bottleneck optimization and automated classical repair fallback."*

---

## Slide 3: System Architecture & The 7-Stage Pipeline

### Slide Content:
```
[4 CSVs: Courses, Enrollments, Rooms, Slots]
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│ 1. Global CP-SAT Solver (OR-Tools) ──► Feasible Baseline  │
└──────────────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Bottleneck Extractor ──► Dense Subproblem (<= 14 Q)   │
└──────────────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│ 3. QUBO & Ising Formulation (1 bit / course: Slot A vs B) │
└──────────────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Parameterized QAOA Execution (Simulator / IBM Kingston)│
└──────────────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│ 5. Classical Bitstring Repair & CP-SAT Validator Gate    │
│    - Hard Violations == 0? AND Soft Score Strictly Lower?│
│    ├── YES ──► Accept Quantum Resolution & Publish       │
│    └── NO  ──► Fallback to Baseline Unchanged (Safety)    │
└──────────────────────────────────────────────────────────┘
```

> **Speaker Notes (<40 words)**:  
> *"Our pipeline never gambles with university operations. CP-SAT finds a feasible global baseline. The extractor isolates a 12-qubit cluster. QAOA samples candidate reassignments, and the repair gate only accepts provable improvements."*

---

## Slide 4: Live Demonstration Walkthrough

### Slide Content:
1. **Dataset Audit**: Ingest courses, rooms, slots, and student enrollments with instant client-side validation.
2. **Timetable Matrix**: CP-SAT solves baseline in 1.42s with zero hard violations.
3. **Cluster Lab**: Visualizing the conflict subgraph with force-directed physics and slot color encoding.
4. **Quantum Convergence**: Watch QAOA expectation energy drop from 182.0 to 118.0.
5. **Decision & Publish**: Classical validator certifies 12 students relieved from back-to-back fatigue.

> **Speaker Notes (<40 words)**:  
> *"In our live demo, CP-SAT generates the campus baseline in 1.4 seconds. In Cluster Lab, we optimize a 6-course conflict cluster on Qiskit QAOA, reducing student fatigue by 64 points before publishing."*

---

## Slide 5: Empirical Benchmarks & Hardware Honesty

### Slide Content:

| Method | Qubits | Objective Energy | Approx Ratio | Feasible % | Runtime | Transpiled Depth | 2Q Gates |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Brute Force** | 6 | 118.0 | 1.000 | 100% | 0.002 s | — | — |
| **OR-Tools CP-SAT** | 6 | 118.0 | 1.000 | 100% | 0.045 s | — | — |
| **Simulated Annealing** | 6 | 118.0 | 1.000 | 95% | 0.022 s | — | — |
| **QAOA Ideal (p=1)** | 6 | 118.0 | 1.000 | 88% | 0.85 s | 14 | 14 |
| **QAOA Noisy (Aer)** | 6 | 128.0 | 0.840 | 65% | 2.15 s | 14 | 14 |
| **IBM Kingston (QPU)** | 6 | 131.0 | 1.000 | 72% | 27.18 s | 65 | 20 ECR |

- **Hardware Execution**: Physical job `dbcfb3vi0auc73durnc0` executed on **IBM Kingston (156 Qubits)**.
- **Honest Finding**: QAOA matches classical optimum on small subproblems; classical is faster today, but QUANTA establishes the real-world harness ready for quantum scaling.

> **Speaker Notes (<40 words)**:  
> *"We executed real jobs on the 156-qubit IBM Kingston processor with depth 65. We make no false supremacy claims: CP-SAT is faster at 6 qubits, but QUANTA provides the certified quantum integration layer."*

---

## Slide 6: Roadmap & Quantify Team

### Slide Content:
- **Short-Term Roadmap**:
  - Warm-start QAOA using CP-SAT dual bounds for initial parameter initialization.
  - Subspace and parity mixers preserving hard constraints natively in Hilbert space.
  - Real-time dynamic rescheduling when exam halls or faculty are disrupted.
- **Team Quantify (VTU-QFF-HC-0076)**:
  - **Yash B Koparde** — Team Lead & Frontend/UI Systems Architecture
  - **Aditya Patange** — Classical Constraint Programming & API Lead
  - **Melwin Fernandes** — Quantum Algorithms & IBM Hardware Telemetry

> **Speaker Notes (<40 words)**:  
> *"Our roadmap targets warm-start QAOA and dynamic rescheduling. Built in 36 hours by Yash Koparde, Aditya Patange, and Melwin Fernandes for the VTU-Qiskit Fall Fest 2026. Thank you!"*
