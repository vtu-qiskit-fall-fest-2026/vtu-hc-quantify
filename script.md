# QUANTA — 2-to-3 Minute Live Demo Script & Dashboard Walkthrough

> **Project**: QUANTA (VTU Qiskit Fall Fest Hackathon 2026 — Team Quantify)  
> **Target Duration**: 2 minutes 30 seconds (Max 3:00)  
> **Live Console**: [https://quanta-web-o99w.onrender.com](https://quanta-web-o99w.onrender.com)  
> **Demo Video**: [https://youtu.be/iZAfUc3S_go](https://youtu.be/iZAfUc3S_go)  
> **Official Slide Deck**: [VTU-QFF-HC-0076.pdf](VTU-QFF-HC-0076.pdf)  
> **Physical IBM Quantum Hardware**: `ibm_marrakesh` / `ibm_kingston` (156-qubit Heron architecture via IBM Cloud Qiskit Runtime)  
> **Verified Job IDs**: `dbdgvgvi0auc73cr3pfg` & `dbcfb3vi0auc73durnc0`

---

## Part 1: Dashboard Architecture & Detailed Section Elaborations

### 1. Homepage / Overview (`/`)
* **Core Description**: The command center of QUANTA. It presents a clean, executive-level summary of the entire timetabling optimization pipeline.
* **Key Elements**:
  * **Top Metrics**: Total enrolled students, total courses, certified hard violations ($0$), baseline vs. quantum soft penalty score, and net improvement percentage.
  * **7-Stage Hybrid Pipeline Stepper**: Interactive visual tracker displaying the state of the end-to-end flow: `1. Extract` $\to$ `2. QUBO` $\to$ `3. Circuit` $\to$ `4. Optimize` $\to$ `5. Sample` $\to$ `6. Repair` $\to$ `7. Decide`.
  * **Guaranteed Safety Invariant**: High-contrast seal verifying that all timetables strictly maintain certified zero hard clashes.

### 2. Dataset Portal (`/dataset`)
* **Core Description**: University data ingestion and automated pre-flight audit portal.
* **Input CSV Pipeline**:
  * We take all university inputs via **4 standardized CSV files**:
    1. `students.csv`: Student IDs and their active course registrations.
    2. `courses.csv`: Course codes, titles, and total student enrollments.
    3. `slots.csv`: Exam dates, time windows (e.g. Morning / Afternoon), and chronological ordering.
    4. `rooms.csv`: Room identifiers and maximum seating capacities.
* **Error-Free Verification Engine**:
  * Before any solver runs, the system performs rigorous client-side and backend schema audits to ensure the input files are **100% correct with zero errors**:
    * Checks for duplicate student-course enrollments.
    * Verifies that course enrollment sizes never exceed total university room capacities.
    * Validates chronological slot continuity and day-slot indexing.
  * Provides instant demo presets (Mini fixture and Full University 800–4,200 student datasets).
  * One-click trigger for Google OR-Tools CP-SAT to generate the global baseline schedule.

### 3. Timetable Master Grid (`/timetable`)
* **Core Description**: The complete generated output timetable for all students (supporting 800+ university students), laid out across Days, Time Slots, and Examination Halls.
* **Key Elements**:
  * **Interactive Master Grid**: Visual matrix where each cell represents an assigned exam slot, color-coded by time window, displaying course codes and seated student counts.
  * **Student Conflict Inspector**: Clicking on any course (e.g., `CRS001`) instantly illuminates its coupled conflict courses across all days, highlighting which exams share students.
  * **Constraint Audit Cards**: Real-time counters certifying:
    * `Hard Violations: 0` (Zero students double-booked, zero room overflows).
    * `Soft Fatigue Penalty`: Quantifies back-to-back testing clashes and consecutive-day fatigue across the student body.

### 4. Cluster Lab (`/clusters`)
* **Core Description**: The quantum optimization stage where we isolate dense exam bottlenecks and deploy quantum algorithms to physical quantum computers.
* **How Exams Are Related to Each Other**:
  * University exams are not independent; when students take multiple courses, their exams are coupled. If Course A and Course B share 20 students, placing them in the same slot or consecutive slots causes severe testing fatigue.
  * The **2D Conflict Graph** visualizes this network:
    * **Nodes**: Circular badges representing courses, with attached pill badges indicating their current exam slot.
    * **Conflict Edges**: High-contrast links connecting conflicting courses, complete with centered weight badges displaying the exact number of shared students (e.g., 20, 16, 8, 4).
* **Deployed on Actual IBM Quantum Hardware**:
  * We formulate the subproblem into a QUBO and map it to an Ising Hamiltonian.
  * We select our target directly from the UI: **Simulator**, **Noisy Aer**, or **Real IBM Quantum Hardware** on IBM Cloud (`ibm_marrakesh` / `ibm_kingston`).
  * As QAOA runs, the live Recharts energy curve plots expectation value convergence from 182 down to 118.
  * An interactive **Before / After** toggle dynamically animates the course reassignments, and the classical repair gate accepts the quantum candidate with certified zero hard clashes.

### 5. Benchmarks & Hardware Telemetry (`/benchmarks`)
* **Core Description**: Comprehensive empirical results, solver comparisons, and raw physical calculations executed by real IBM Quantum Cloud hardware.
* **IBM Hardware Results & Calculations**:
  * **Physical QPUs**: Executed on IBM's 156-qubit Heron processors (`ibm_marrakesh` & `ibm_kingston`).
  * **Job Verification**: Shows exact IBM Quantum Job IDs (e.g., `dbdgvgvi0auc73cr3pfg` and `dbcfb3vi0auc73durnc0`).
  * **Quantum Circuit Telemetry**: Transpiled circuit depth (**65–123**) and **20–46 two-qubit gates** (CZ/ECR basis).
  * **Execution Metrics**: Exact queue duration ($9.0\text{s}$), physical QPU execution duration ($27–33\text{s}$), and 4,096 shots with readout error mitigation.
  * **Calculated Accuracy**: Achieved an **Approximation Ratio of 1.0**, proving that the physical IBM quantum hardware reached exact ground state energy parity.
  * **Raw Telemetry Drawer**: A built-in JSON viewer allows judges to inspect the raw, cryptographically signed telemetry payload directly from IBM Quantum Cloud.

---

## Part 2: Real IBM Cloud Hardware Execution Details

When presenting, emphasize that **QUANTA is not just a simulation prototype—it has executed on physical quantum processors on the IBM Cloud**:

* **IBM Cloud Service**: Qiskit Runtime Service (`qiskit-ibm-runtime`) using production API credentials.
* **QPU Target**: `ibm_marrakesh` & `ibm_kingston` (156-Qubit Heron Architecture).
* **Transpiled Circuit**: Optimized to Depth **65–123** with **20–46 two-qubit gates** (CZ / ECR basis).
* **Execution Telemetry**:
  * **Job ID**: `dbdgvgvi0auc73cr3pfg` / `dbcfb3vi0auc73durnc0`
  * **Queue Time**: 9.0 – 9.47 seconds
  * **QPU Execution Time**: 27.18 – 33.20 seconds
  * **Shots**: 4,096 shots with readout error mitigation
  * **Approximation Ratio**: **1.0** (Exact ground state energy reached on physical hardware).
* **Verification in Dashboard**: Available under `/benchmarks` with the click of a button (**"View Raw Telemetry JSON"**), exposing the full signed response payload from IBM Quantum Cloud.

---

## Part 3: The 2.5-Minute Word-for-Word Demo Script

### ⏱️ Timeline Summary
* **0:00 – 0:30 (30s)**: Homepage Overview & Problem Definition (`/`)
* **0:30 – 1:00 (30s)**: Dataset CSV Validation & Master Timetable for All Students (`/dataset` $\to$ `/timetable`)
* **1:00 – 1:55 (55s)**: Cluster Lab Exam Relations & QAOA on Real IBM Hardware (`/clusters`)
* **1:55 – 2:30 (35s)**: Benchmarks & Calculations by IBM Quantum Hardware (`/benchmarks`)

---

### Cue Table: What to Show vs. What to Say

```
====================================================================================================
TIMING: 0:00 - 0:30 | SCREEN: Overview (http://localhost:5173/)
====================================================================================================
WHAT TO SHOW:
1. Start on the Homepage (Overview).
2. Point your cursor to the top green status badge: "0 hard violations".
3. Hover over the 7-stage hybrid pipeline stepper:
   [Extract -> QUBO -> Circuit -> Optimize -> Sample -> Repair -> Decide].

WHAT TO SAY:
"Good morning, judges. University exam timetabling is a massive NP-hard combinatorial 
problem. Pure classical solvers get trapped in dense local trade-offs, while pure quantum 
cannot scale to an entire campus and risks violating hard room constraints.

We built QUANTA: a production-ready hybrid quantum-classical timetabling system. By embedding 
IBM Quantum QAOA inside a provably safe Google OR-Tools classical harness, QUANTA guarantees 
certified zero hard violations while strictly minimizing student testing fatigue."
====================================================================================================
```

```
====================================================================================================
TIMING: 0:30 - 1:00 | SCREEN: Dataset (/dataset) -> Timetable (/timetable)
====================================================================================================
WHAT TO SHOW:
1. Click 'Dataset' in the navigation header.
2. Point to the 4 CSV cards: students.csv, courses.csv, slots.csv, rooms.csv.
3. Highlight the green audit checks: "Enrollment Verified", "Capacity Checked", "Zero Errors".
4. Click 'Timetable' in the navigation header.
5. Point to the Day x Slot master schedule generated for all 800 students.
6. Click course 'CRS001' to highlight its coupled conflict courses.

WHAT TO SAY:
"In our Dataset portal, we ingest the entire university structure using 4 standard CSV files: 
students, courses, slots, and rooms. Our pre-flight audit engine validates every record to 
ensure the input files are strictly correct with zero errors—preventing duplicate enrollments 
and room overflows.

Next, our classical CP-SAT solver generates the global baseline timetable for all 800 
students in under 1.5 seconds with certified zero hard clashes. 

However, looking at the schedule, students still suffer severe soft fatigue from back-to-back 
and same-day exams. Clicking any course reveals its coupled conflicts with other exams."
====================================================================================================
```

```
====================================================================================================
TIMING: 1:00 - 1:55 | SCREEN: Cluster Lab (/clusters)
====================================================================================================
WHAT TO SHOW:
1. Click 'Cluster Lab' in the navigation header.
2. In 'Extracted Clusters' on the left, click 'cluster_01'.
3. Point to the Conflict Graph in the center tile:
   - Point out the cleanly separated course nodes.
   - Show how each exam is related to the next: highlight the dark green links and the 
     shared-students badges (e.g., 20, 16, 8, 4).
   - Point out the attached slot badges (D5S4, D5S2) anchored below each node.
4. On the right panel ('QAOA Solver Parameters'), highlight the backend selector:
   - Point to [Sim | Noisy | IBM QPU].
5. Click 'Run QAOA Pipeline (r)'.
6. Watch the live Recharts energy curve converge from 182 down to 118.
7. Click the 'Before / After' toggle to animate the reassigned exam slots.
8. Click 'Publish Resolution'.

WHAT TO SAY:
"This is the Cluster Lab. Here, we isolate the densest exam bottleneck into a 12-course 
subproblem. 

This conflict graph shows exactly how each exam is related to the next. The lines and badges 
quantify the shared students between courses, explaining why they cannot sit in the same slot.

We map this subproblem to a 12-qubit Ising Hamiltonian and deploy the QAOA algorithm. Crucially, 
we can run this directly on actual IBM Quantum hardware via IBM Cloud. 

As the optimization converges, expectation energy drops from 182 to 118. Our classical repair 
gate certifies zero hard clashes and accepts the quantum solution, reducing fatigue for 
dozens of students. We click 'Publish' to hot-patch the master timetable."
====================================================================================================
```

```
====================================================================================================
TIMING: 1:55 - 2:30 | SCREEN: Benchmarks (/benchmarks)
====================================================================================================
WHAT TO SHOW:
1. Click 'Benchmarks' in the navigation header.
2. Scroll down to the 'Physical Hardware Telemetry: IBM Quantum Cloud' card.
3. Highlight backend: 'ibm_marrakesh / ibm_kingston (156 Qubits)'.
4. Point to the hardware calculations: Job ID 'dbdgvgvi0auc73cr3pfg', Depth: 65, 
   Two-Qubit Gates: 20, Approximation Ratio: 1.0.
5. Click 'View Raw Telemetry JSON' to open the drawer showing the actual IBM Cloud JSON response.

WHAT TO SAY:
"Finally, the Benchmarks page displays all the calculations and telemetry executed on real 
IBM Quantum hardware. 

Using IBM Cloud's Qiskit Runtime, we deployed to 156-qubit Heron processors—ibm_marrakesh 
and ibm_kingston. Under Job ID dbdgvgvi0auc73cr3pfg, with a circuit depth of 65 and 20 two-qubit 
gates across 4,096 shots, our execution achieved an approximation ratio of 1.0, reaching exact 
ground energy parity on physical qubits.

You can inspect the signed IBM Cloud telemetry directly in this JSON drawer. QUANTA proves 
that quantum optimization provides immediate, certified value when paired with a classical safety harness. 
Thank you!"
====================================================================================================
```

---

## Part 4: Judge Q&A Defense Sheet (Instant Answers)

### Q1: "Why not just let CP-SAT solve the whole thing including soft constraints?"
> **Answer**: "CP-SAT excels at finding feasible trees, but on dense quadratic soft objectives with thousands of cross-course student overlaps, classical branch-and-bound suffers exponential slowdowns and stagnates in local minima. By extracting the dense sub-graph into an Ising Hamiltonian, QAOA explores the superposition of coupled trade-offs in polynomial circuit depth ($p \le 2$), while classical CP-SAT guarantees global feasibility."

### Q2: "Did you actually run this on IBM Cloud hardware or just a simulator?"
> **Answer**: "Both! For the 3-second live presentation, we use the local statevector simulator. But our benchmark suite includes 41 physical hardware executions on IBM Cloud's 156-qubit Heron QPUs (`ibm_marrakesh` and `ibm_kingston`). You can inspect the raw IBM Quantum Cloud JSON telemetry directly on our Benchmarks page, complete with IBM Job IDs, queue times, and transpiled circuit depths."

### Q3: "What happens if quantum noise produces an invalid schedule?"
> **Answer**: "Hard constraints are never traded for score. Every bitstring sampled from the QPU passes through our classical repair and validation gate. If a candidate introduces even a single hard room or double-booking violation, or fails to beat the baseline soft score, our pipeline rejects it and automatically falls back to the classical baseline. Zero hard violations is a certified invariant."

