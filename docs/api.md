# QUANTA REST API Specification

Base URL: `/api`  
Data format: JSON  
Headers: `X-Role: coordinator | researcher` (default: `coordinator`)  
Standard Error Format: `{"error": {"code": "STRING", "message": "Human readable explanation"}}`

---

## 1. System & Health

### `GET /api/health`
Checks API service health and mock execution mode.
- **Request**: None
- **Response** `200 OK`:
  ```json
  {
    "status": "ok",
    "mock": false,
    "version": "1.0.0"
  }
  ```

---

## 2. Dataset Ingestion

### `POST /api/datasets`
Uploads and validates 4 examination dataset CSV files.
- **Request**: Multipart Form Data
  - `courses`: CSV file (`course_id,name,dept,duration_min`)
  - `enrollments`: CSV file (`student_id,course_id`)
  - `rooms`: CSV file (`room_id,building,capacity`)
  - `slots`: CSV file (`slot_id,day,start,end,order`)
- **Response** `200 OK`:
  ```json
  {
    "dataset_id": "ds_1792606500",
    "stats": {
      "courses": 180,
      "students": 4200,
      "rooms": 22,
      "slots": 15
    },
    "warnings": []
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{"error": {"code": "INVALID_CSV", "message": "Failed to parse CSV files..."}}`

---

## 3. Run Management & Baseline Solving

### `POST /api/runs`
Initializes a new timetable optimization run.
- **Request Body**:
  ```json
  {
    "dataset_id": "ds_mini",
    "seed": 42
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "run_id": "run_1792606510"
  }
  ```

### `POST /api/runs/{run_id}/baseline`
Submits an asynchronous background job to solve the global CP-SAT baseline timetable.
- **Request Body**:
  ```json
  {
    "time_limit_s": 60
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "job_id": "job_base_run_1792606510",
    "kind": "baseline",
    "status": "running",
    "stage": "solve",
    "progress": 0.2,
    "energy_trace": [],
    "result_ref": "/api/runs/run_1792606510"
  }
  ```

### `GET /api/runs/{run_id}`
Retrieves full details of a run, including current baseline timetable, extracted clusters, and decisions.
- **Response** `200 OK`:
  ```json
  {
    "run": {
      "run_id": "run_1792606510",
      "dataset_id": "ds_mini",
      "seed": 42
    },
    "timetable": {
      "run_id": "run_baseline",
      "assignments": [],
      "hard_violations": 0,
      "soft_score": 462.0,
      "penalty_breakdown": {
        "back_to_back": 38,
        "three_in_day": 11,
        "two_in_day": 49
      },
      "solve_seconds": 2.32
    },
    "clusters": [],
    "decisions": []
  }
  ```

### `POST /api/runs/{run_id}/cache-load`
Instantly restores a certified pre-computed demo run for presentations.
- **Response** `200 OK`:
  Same payload as `GET /api/runs/{run_id}` populated with certified demo timetable, clusters, and accepted decisions.

---

## 4. Conflict Cluster Extraction

### `POST /api/runs/{run_id}/clusters/extract`
Extracts dense conflict bottleneck subgraphs from the baseline schedule.
- **Request Body**:
  ```json
  {
    "max_size": 12,
    "top_k": 5
  }
  ```
- **Response** `200 OK`: Array of `SubProblem`:
  ```json
  [
    {
      "cluster_id": "cluster_01",
      "courses": ["CRS001", "CRS002", "CRS003", "CRS004"],
      "candidates": {
        "CRS001": ["D1S1", "D2S1"]
      },
      "sizes": {
        "CRS001": 15
      },
      "pair_weights": [],
      "fixed_neighbors": [],
      "spare_capacity": {},
      "slot_meta": {},
      "affected_students": 60,
      "baseline_cluster_cost": 11.0
    }
  ]
  ```

---

## 5. Quantum Optimization & Job Telemetry

### `POST /api/runs/{run_id}/clusters/{cid}/quantum`
Submits a variational QAOA job for a bottleneck cluster.
- **Headers**:
  - `X-Role: coordinator` (access to `ideal` only)
  - `X-Role: researcher` (access to `ideal`, `noisy`, `fake_ibm`, `ibm`)
- **Request Body**:
  ```json
  {
    "backend": "ideal",
    "p": 1,
    "optimizer": "COBYLA",
    "shots": 2048,
    "seed": 7,
    "lambda_cap": 0.0
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "job_id": "job_q_cluster_01_1792606550",
    "kind": "quantum",
    "status": "running",
    "stage": "qubo",
    "progress": 0.1,
    "energy_trace": [182.0],
    "result_ref": "/api/runs/run_1792606510/clusters/cluster_01/result"
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: `{"error": {"code": "FORBIDDEN", "message": "Only users with the researcher role may submit jobs to IBM Quantum hardware or noisy simulation."}}`

### `GET /api/jobs/{job_id}`
Polls asynchronous background job progress and energy telemetry.
- **Response** `200 OK`:
  ```json
  {
    "job_id": "job_q_cluster_01_1792606550",
    "kind": "quantum",
    "status": "done",
    "stage": "done",
    "progress": 1.0,
    "energy_trace": [182.0, 165.4, 150.2, 138.0, 126.5, 118.0],
    "result_ref": "/api/runs/run_1792606510/clusters/cluster_01/result",
    "error": null
  }
  ```

### `GET /api/runs/{run_id}/clusters/{cid}/result`
Retrieves quantum optimization results and authoritative classical decision.
- **Response** `200 OK`:
  ```json
  {
    "quantum": {
      "backend": "ideal",
      "p": 1,
      "shots": 4096,
      "approx_ratio": 1.0,
      "depth": 14,
      "two_qubit_gates": 14
    },
    "decision": {
      "cluster_id": "cluster_01",
      "source": "quantum_repaired",
      "before_score": 182.0,
      "after_score": 118.0,
      "resolved_students": 64,
      "hard_violations": 0,
      "changes": [["CRS001", "D1S1", "D2S1"]],
      "feasible_fraction": 0.85,
      "reason": "Quantum QAOA candidate accepted: soft penalty reduced from 182.0 to 118.0 with 0 hard violations."
    }
  }
  ```

---

## 6. Benchmarks & Hardware Telemetry

### `GET /api/runs/{run_id}/benchmarks`
Retrieves comparative benchmark rows across classical and quantum solvers.
- **Response** `200 OK`:
  ```json
  {
    "rows": [
      {
        "cluster_size": 6,
        "seed": 42,
        "method": "qaoa_ideal_p1",
        "objective": 118.0,
        "approx_ratio": 1.0,
        "feasible_pct": 0.85,
        "runtime_s": 0.85,
        "failed": false
      }
    ],
    "hardware": [
      {
        "backend": "ibm_brisbane",
        "qubits": 127,
        "status": "active",
        "queue_time_s": 240
      }
    ],
    "figures": []
  }
  ```

---

## 7. Publishing & Schedule Export

### `POST /api/runs/{run_id}/publish`
Applies accepted quantum decisions and audits for 0 hard violations before publishing.
- **Request Body**:
  ```json
  {
    "cluster_ids": ["cluster_01"]
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "timetable": {
      "run_id": "run_baseline_repaired",
      "hard_violations": 0,
      "soft_score": 118.0
    },
    "export_url": "/api/runs/run_1792606510/export.csv"
  }
  ```

### `GET /api/runs/{run_id}/export.csv`
Exports final verified timetable as standard CSV (`course_id,slot_id,room_ids`).
- **Response** `200 OK`:
  - `Content-Type: text/csv`
  - Attachment filename: `quanta_timetable_{run_id}.csv`
