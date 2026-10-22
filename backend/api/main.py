"""QUANTA FastAPI Application implementing docs/CONTRACTS.md.

Task: A5b (Member A: Classical core + backend)
Supports real classical-quantum pipeline execution and fast mock mode (QUANTA_MOCK=1).
"""
from __future__ import annotations

import csv
import io
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    Header,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from backend.api.db import (
    complete_job,
    create_job,
    fail_job,
    get_job,
    init_db,
    update_job_progress,
)
from backend.core.baseline import solve_baseline
from backend.core.extractor import extract_clusters
from backend.core.repair import construct_repaired_timetable, decide
from backend.core.scorer import score_timetable
from backend.schemas import (
    BenchmarkRow,
    Course,
    Dataset,
    Enrollment,
    FinalDecision,
    Job,
    QuantumConfig,
    QuantumResult,
    Room,
    Slot,
    SubProblem,
    Timetable,
)

app = FastAPI(
    title="QUANTA API",
    description="Hybrid CP-SAT + QAOA university examination timetabling platform",
    version="1.0.0",
)

# Standardized error format handler per docs/CONTRACTS.md: {error: {code, message}}
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    code = "ERROR"
    if exc.status_code == 400:
        code = "BAD_REQUEST"
    elif exc.status_code == 403:
        code = "FORBIDDEN"
    elif exc.status_code == 404:
        code = "NOT_FOUND"
    elif exc.status_code == 501:
        code = "NOT_IMPLEMENTED"
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": str(exc.detail)}},
    )


# Enable CORS for frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def is_mock() -> bool:
    """Returns True if mock mode is active (default 1 unless set to 0)."""
    return os.getenv("QUANTA_MOCK", "1") == "1"
FIXTURES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures"
RUNS_DIR = Path(__file__).resolve().parent.parent.parent / "runs"
BENCHMARKS_DIR = Path(__file__).resolve().parent.parent.parent / "benchmarks"
EXECUTOR = ThreadPoolExecutor(max_workers=4)

# Initialize SQLite database on startup
init_db()


def load_fixture(filename: str) -> Any:
    """Helper to read static fixture files."""
    filepath = FIXTURES_DIR / filename
    if not filepath.exists():
        raise HTTPException(
            status_code=500,
            detail={"error": {"code": "FIXTURE_NOT_FOUND", "message": f"Fixture not found: {filename}"}},
        )
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def load_dataset_from_dir(dataset_dir: Path) -> Dataset:
    """Loads a structured Dataset from a directory containing the four CSVs."""
    with open(dataset_dir / "courses.csv", "r", encoding="utf-8") as f:
        courses = [Course.model_validate(row) for row in csv.DictReader(f)]
    with open(dataset_dir / "enrollments.csv", "r", encoding="utf-8") as f:
        enrollments = [Enrollment.model_validate(row) for row in csv.DictReader(f)]
    with open(dataset_dir / "rooms.csv", "r", encoding="utf-8") as f:
        rooms = [Room.model_validate(row) for row in csv.DictReader(f)]
    with open(dataset_dir / "slots.csv", "r", encoding="utf-8") as f:
        slots = [Slot.model_validate(row) for row in csv.DictReader(f)]
    return Dataset(courses=courses, enrollments=enrollments, rooms=rooms, slots=slots)


# ---------------------------------------------------------------------------
# 1. Health & Discovery
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "mock": is_mock(),
        "version": "1.0.0",
    }


# ---------------------------------------------------------------------------
# 2. Dataset Ingestion & Validation
# ---------------------------------------------------------------------------

@app.post("/api/datasets")
async def upload_datasets(
    courses: UploadFile | None = File(None),  # noqa: B008
    enrollments: UploadFile | None = File(None),  # noqa: B008
    rooms: UploadFile | None = File(None),  # noqa: B008
    slots: UploadFile | None = File(None),  # noqa: B008
):
    """Validates and ingests 4 multipart dataset CSVs."""
    if is_mock() and not courses:
        return {
            "dataset_id": "ds_mini",
            "stats": {"courses": 12, "students": 60, "rooms": 4, "slots": 8},
            "warnings": [],
        }

    warnings: list[str] = []

    # Check that all four files were provided
    if not courses or not enrollments or not rooms or not slots:
        # If running headlessly or falling back, default to mini fixture
        mini_dir = FIXTURES_DIR / "mini"
        if mini_dir.exists():
            ds = load_dataset_from_dir(mini_dir)
            dataset_id = "ds_mini"
            stats = {
                "courses": len(ds.courses),
                "students": len({e.student_id for e in ds.enrollments}),
                "rooms": len(ds.rooms),
                "slots": len(ds.slots),
            }
            return {"dataset_id": dataset_id, "stats": stats, "warnings": []}

        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "MISSING_FILES", "message": "All four CSV files (courses, enrollments, rooms, slots) are required."}},
        )

    try:
        courses_content = (await courses.read()).decode("utf-8")
        enrollments_content = (await enrollments.read()).decode("utf-8")
        rooms_content = (await rooms.read()).decode("utf-8")
        slots_content = (await slots.read()).decode("utf-8")

        parsed_courses = [Course.model_validate(row) for row in csv.DictReader(io.StringIO(courses_content))]
        parsed_enrollments = [Enrollment.model_validate(row) for row in csv.DictReader(io.StringIO(enrollments_content))]
        parsed_rooms = [Room.model_validate(row) for row in csv.DictReader(io.StringIO(rooms_content))]
        parsed_slots = [Slot.model_validate(row) for row in csv.DictReader(io.StringIO(slots_content))]

        course_ids = {c.course_id for c in parsed_courses}
        for e in parsed_enrollments:
            if e.course_id not in course_ids:
                warnings.append(f"Enrollment references unknown course_id '{e.course_id}'")

        ds = Dataset(
            courses=parsed_courses,
            enrollments=parsed_enrollments,
            rooms=parsed_rooms,
            slots=parsed_slots,
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "INVALID_CSV", "message": f"Failed to parse CSV files: {e}"}},
        ) from e

    dataset_id = f"ds_{int(time.time())}"
    upload_dir = Path("data") / "uploads" / dataset_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / "dataset.json").write_text(ds.model_dump_json(indent=2), encoding="utf-8")

    stats = {
        "courses": len(ds.courses),
        "students": len({e.student_id for e in ds.enrollments}),
        "rooms": len(ds.rooms),
        "slots": len(ds.slots),
    }

    return {
        "dataset_id": dataset_id,
        "stats": stats,
        "warnings": warnings,
    }


# ---------------------------------------------------------------------------
# 3. Runs & Baseline Solving
# ---------------------------------------------------------------------------

class RunCreate(BaseModel):
    dataset_id: str = "ds_mini"
    seed: int = 42


@app.post("/api/runs")
def create_run(req: RunCreate):
    run_id = f"run_{int(time.time() * 1000)}"
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    # Resolve dataset
    ds: Dataset
    if req.dataset_id in ("ds_mini", "mini"):
        ds = load_dataset_from_dir(FIXTURES_DIR / "mini")
    else:
        upload_path = Path("data") / "uploads" / req.dataset_id / "dataset.json"
        if upload_path.exists():
            with open(upload_path, "r", encoding="utf-8") as f:
                ds = Dataset.model_validate_json(f.read())
        else:
            ds = load_dataset_from_dir(FIXTURES_DIR / "mini")

    with open(run_dir / "dataset.json", "w", encoding="utf-8") as f:
        f.write(ds.model_dump_json(indent=2))

    meta = {
        "run_id": run_id,
        "dataset_id": req.dataset_id,
        "seed": req.seed,
        "created_at": time.time(),
    }
    with open(run_dir / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return {"run_id": run_id}


class BaselineRequest(BaseModel):
    time_limit_s: int = 60


def _execute_baseline_solver(run_id: str, job_id: str, time_limit_s: int, seed: int):
    """Background task function executing CP-SAT baseline."""
    try:
        update_job_progress(job_id, stage="solve", progress=0.2)
        run_dir = RUNS_DIR / run_id
        with open(run_dir / "dataset.json", "r", encoding="utf-8") as f:
            ds = Dataset.model_validate_json(f.read())

        update_job_progress(job_id, stage="solve", progress=0.5)
        tt = solve_baseline(ds, time_limit_s=time_limit_s, seed=seed)

        with open(run_dir / "baseline.json", "w", encoding="utf-8") as f:
            f.write(tt.model_dump_json(indent=2))

        complete_job(job_id, result_ref=f"/api/runs/{run_id}")
    except Exception as e:  # noqa: BLE001
        fail_job(job_id, str(e))


@app.post("/api/runs/{run_id}/baseline")
def run_baseline(
    run_id: str,
    req: BaselineRequest,
    background_tasks: BackgroundTasks,
):
    job_id = f"job_base_{run_id}"

    if is_mock():
        create_job(job_id, kind="baseline", stage="solve", progress=0.2, result_ref=f"/api/runs/{run_id}")
        return Job(
            job_id=job_id,
            kind="baseline",
            status="running",
            stage="solve",
            progress=0.2,
            energy_trace=[],
            result_ref=f"/api/runs/{run_id}",
        )

    run_dir = RUNS_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Run {run_id} not found"}})

    with open(run_dir / "meta.json", "r", encoding="utf-8") as f:
        meta = json.load(f)

    create_job(job_id, kind="baseline", stage="queued", progress=0.0, result_ref=f"/api/runs/{run_id}")
    EXECUTOR.submit(_execute_baseline_solver, run_id, job_id, req.time_limit_s, meta.get("seed", 42))

    job = get_job(job_id)
    return job or Job(
        job_id=job_id,
        kind="baseline",
        status="running",
        stage="queued",
        progress=0.0,
        result_ref=f"/api/runs/{run_id}",
    )


@app.get("/api/runs/{run_id}")
def get_run_details(run_id: str):
    if is_mock():
        tt_data = load_fixture("timetable.json")
        sp_data = load_fixture("subproblem_6.json")
        dec_data = load_fixture("decision_accepted.json")
        return {
            "run": {"run_id": run_id, "dataset_id": "ds_mini"},
            "timetable": Timetable.model_validate(tt_data),
            "clusters": [SubProblem.model_validate(sp_data)],
            "decisions": [FinalDecision.model_validate(dec_data)],
        }

    run_dir = RUNS_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Run {run_id} not found"}})

    with open(run_dir / "meta.json", "r", encoding="utf-8") as f:
        meta = json.load(f)

    tt = None
    if (run_dir / "baseline.json").exists():
        with open(run_dir / "baseline.json", "r", encoding="utf-8") as f:
            tt = Timetable.model_validate_json(f.read())

    clusters = []
    if (run_dir / "clusters.json").exists():
        with open(run_dir / "clusters.json", "r", encoding="utf-8") as f:
            clusters_raw = json.load(f)
            clusters = [SubProblem.model_validate(c) for c in clusters_raw]

    decisions = []
    for dec_file in run_dir.glob("cluster_*_decision.json"):
        with open(dec_file, "r", encoding="utf-8") as f:
            decisions.append(FinalDecision.model_validate_json(f.read()))

    return {
        "run": meta,
        "timetable": tt,
        "clusters": clusters,
        "decisions": decisions,
    }


# ---------------------------------------------------------------------------
# 4. Bottleneck Cluster Extraction
# ---------------------------------------------------------------------------

class ExtractRequest(BaseModel):
    max_size: int = 12
    top_k: int = 5


@app.post("/api/runs/{run_id}/clusters/extract")
def extract_run_clusters(run_id: str, req: ExtractRequest):
    if is_mock():
        sp_data = load_fixture("subproblem_6.json")
        return [SubProblem.model_validate(sp_data)]

    run_dir = RUNS_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Run {run_id} not found"}})

    baseline_file = run_dir / "baseline.json"
    if not baseline_file.exists():
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "BASELINE_REQUIRED", "message": "Baseline timetable must be computed prior to cluster extraction."}},
        )

    with open(run_dir / "dataset.json", "r", encoding="utf-8") as f:
        ds = Dataset.model_validate_json(f.read())
    with open(baseline_file, "r", encoding="utf-8") as f:
        tt = Timetable.model_validate_json(f.read())

    clusters = extract_clusters(ds, tt, max_size=req.max_size, top_k=req.top_k)
    with open(run_dir / "clusters.json", "w", encoding="utf-8") as f:
        f.write(json.dumps([c.model_dump() for c in clusters], indent=2))

    return clusters


# ---------------------------------------------------------------------------
# 5. Quantum Optimization & Job Telemetry
# ---------------------------------------------------------------------------

def _execute_quantum_pipeline(run_id: str, cid: str, job_id: str, cfg: QuantumConfig):
    """Background task executing QAOA, bitstring repair, and final decision."""
    try:
        # Lazy import of quantum interface
        try:
            from backend.quantum.interface import run_quantum
        except ImportError as ie:
            fail_job(job_id, f"Quantum interface not implemented: {ie}")
            return

        run_dir = RUNS_DIR / run_id
        with open(run_dir / "dataset.json", "r", encoding="utf-8") as f:
            ds = Dataset.model_validate_json(f.read())
        with open(run_dir / "baseline.json", "r", encoding="utf-8") as f:
            tt = Timetable.model_validate_json(f.read())
        with open(run_dir / "clusters.json", "r", encoding="utf-8") as f:
            clusters = [SubProblem.model_validate(c) for c in json.load(f)]

        sp = next((c for c in clusters if c.cluster_id == cid), None)
        if not sp:
            fail_job(job_id, f"Cluster {cid} not found in clusters.json")
            return

        def progress_callback(stage: str, progress: float, energy: float | None = None):
            update_job_progress(job_id, stage=stage, progress=progress, energy=energy)

        # Run variational QAOA
        qr: QuantumResult = run_quantum(sp, cfg, progress_cb=progress_callback)
        with open(run_dir / f"cluster_{cid}_quantum.json", "w", encoding="utf-8") as f:
            f.write(qr.model_dump_json(indent=2))

        # Run classical repair gate
        update_job_progress(job_id, stage="repair", progress=0.9)
        decision = decide(ds, tt, sp, qr)
        with open(run_dir / f"cluster_{cid}_decision.json", "w", encoding="utf-8") as f:
            f.write(decision.model_dump_json(indent=2))

        complete_job(job_id, result_ref=f"/api/runs/{run_id}/clusters/{cid}/result")
    except Exception as e:  # noqa: BLE001
        fail_job(job_id, str(e))


@app.post("/api/runs/{run_id}/clusters/{cid}/quantum")
def submit_quantum_job(
    run_id: str,
    cid: str,
    cfg: QuantumConfig,
    x_role: str = Header(default="coordinator", alias="X-Role"),
):
    # Enforce role restriction per docs/CONTRACTS.md
    if x_role != "researcher" and cfg.backend in ("ibm", "noisy"):
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Only users with the researcher role may submit jobs to IBM Quantum hardware or noisy simulation.",
                }
            },
        )

    job_id = f"job_q_{cid}_{int(time.time() * 1000)}"

    if is_mock():
        create_job(job_id, kind="quantum", stage="qubo", progress=0.1, result_ref=f"/api/runs/{run_id}/clusters/{cid}/result")
        return Job(
            job_id=job_id,
            kind="quantum",
            status="running",
            stage="qubo",
            progress=0.1,
            energy_trace=[182.0],
            result_ref=f"/api/runs/{run_id}/clusters/{cid}/result",
        )

    run_dir = RUNS_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Run {run_id} not found"}})

    # Check that quantum interface can be imported
    try:
        import backend.quantum.interface  # noqa: F401
    except ImportError as e:
        raise HTTPException(
            status_code=501,
            detail={"error": {"code": "NOT_IMPLEMENTED", "message": f"Quantum interface unavailable: {e}"}},
        ) from e

    create_job(job_id, kind="quantum", stage="qubo", progress=0.05, result_ref=f"/api/runs/{run_id}/clusters/{cid}/result")
    EXECUTOR.submit(_execute_quantum_pipeline, run_id, cid, job_id, cfg)

    job = get_job(job_id)
    return job or Job(
        job_id=job_id,
        kind="quantum",
        status="running",
        stage="qubo",
        progress=0.05,
        result_ref=f"/api/runs/{run_id}/clusters/{cid}/result",
    )


@app.get("/api/jobs/{job_id}", response_model=Job)
def get_job_status(job_id: str):
    if is_mock():
        job = get_job(job_id)
        if not job:
            return Job(
                job_id=job_id,
                kind="quantum",
                status="done",
                stage="done",
                progress=1.0,
                energy_trace=[182.0, 165.4, 150.2, 138.0, 126.5, 118.0],
            )
        return job

    job = get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": f"Job {job_id} not found"}},
        )
    return job


@app.get("/api/runs/{run_id}/clusters/{cid}/result")
def get_cluster_result(run_id: str, cid: str):
    if is_mock():
        qr_data = load_fixture("quantum_result.json")
        dec_data = load_fixture("decision_accepted.json")
        return {
            "quantum": QuantumResult.model_validate(qr_data),
            "decision": FinalDecision.model_validate(dec_data),
        }

    run_dir = RUNS_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Run {run_id} not found"}})

    q_file = run_dir / f"cluster_{cid}_quantum.json"
    d_file = run_dir / f"cluster_{cid}_decision.json"

    if not q_file.exists() or not d_file.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": f"Results for cluster {cid} not ready or not found."}},
        )

    with open(q_file, "r", encoding="utf-8") as f:
        qr = QuantumResult.model_validate_json(f.read())
    with open(d_file, "r", encoding="utf-8") as f:
        decision = FinalDecision.model_validate_json(f.read())

    return {"quantum": qr, "decision": decision}


# ---------------------------------------------------------------------------
# 6. Benchmarks & Telemetry
# ---------------------------------------------------------------------------

@app.get("/api/runs/{run_id}/benchmarks")
def get_benchmarks(run_id: str):
    if is_mock():
        bench_data = load_fixture("benchmarks.json")
        rows = [BenchmarkRow.model_validate(r) for r in bench_data]
        return {
            "rows": rows,
            "hardware": [{"backend": "ibm_brisbane", "qubits": 127, "status": "active", "queue_time_s": 240}],
            "figures": [],
        }

    rows: list[BenchmarkRow] = []
    results_csv = BENCHMARKS_DIR / "results.csv"
    if results_csv.exists():
        try:
            with open(results_csv, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    rows.append(BenchmarkRow.model_validate(row))
        except (csv.Error, OSError, ValueError):
            rows = []

    hardware: list[dict[str, Any]] = []
    hardware_dir = RUNS_DIR / "hardware"
    if hardware_dir.exists():
        for h_file in hardware_dir.glob("*.json"):
            try:
                with open(h_file, "r", encoding="utf-8") as f:
                    hardware.append(json.load(f))
            except (json.JSONDecodeError, OSError):
                continue

    return {
        "rows": rows,
        "hardware": hardware,
        "figures": [],
    }


# ---------------------------------------------------------------------------
# 7. Publishing & CSV Export
# ---------------------------------------------------------------------------

class PublishRequest(BaseModel):
    cluster_ids: list[str] = []


@app.post("/api/runs/{run_id}/publish")
def publish_schedule(run_id: str, req: PublishRequest):
    if is_mock():
        tt_data = load_fixture("timetable.json")
        return {
            "timetable": Timetable.model_validate(tt_data),
            "export_url": f"/api/runs/{run_id}/export.csv",
        }

    run_dir = RUNS_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Run {run_id} not found"}})

    baseline_file = run_dir / "baseline.json"
    if not baseline_file.exists():
        raise HTTPException(
            status_code=400,
            detail={"error": {"code": "BASELINE_REQUIRED", "message": "Baseline timetable required before publishing"}},
        )

    with open(run_dir / "dataset.json", "r", encoding="utf-8") as f:
        ds = Dataset.model_validate_json(f.read())
    with open(baseline_file, "r", encoding="utf-8") as f:
        tt = Timetable.model_validate_json(f.read())

    # Sequentially apply accepted decisions for specified cluster IDs
    for cid in req.cluster_ids:
        dec_file = run_dir / f"cluster_{cid}_decision.json"
        if dec_file.exists():
            with open(dec_file, "r", encoding="utf-8") as f:
                decision = FinalDecision.model_validate_json(f.read())
            if decision.source == "quantum_repaired":
                changes_map = {c: to_s for (c, _, to_s) in decision.changes}
                tt = construct_repaired_timetable(ds, tt, changes_map)

    # Re-verify 0 hard violations before publishing per contract
    audited = score_timetable(ds, tt)
    if audited.hard_violations > 0:
        raise HTTPException(
            status_code=422,
            detail={"error": {"code": "HARD_VIOLATION", "message": f"Published timetable failed audit with {audited.hard_violations} hard violation(s)."}},
        )

    with open(run_dir / "published_timetable.json", "w", encoding="utf-8") as f:
        f.write(audited.model_dump_json(indent=2))

    return {
        "timetable": audited,
        "export_url": f"/api/runs/{run_id}/export.csv",
    }


@app.get("/api/runs/{run_id}/export.csv")
def export_csv(run_id: str):
    if is_mock():
        tt_data = load_fixture("timetable.json")
        csv_rows = ["course_id,slot_id,room_ids"]
        for a in tt_data.get("assignments", []):
            rooms = ";".join(a.get("room_ids", []))
            csv_rows.append(f"{a['course_id']},{a['slot_id']},{rooms}")
        content = "\n".join(csv_rows)
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=quanta_timetable_{run_id}.csv"},
        )

    run_dir = RUNS_DIR / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": f"Run {run_id} not found"}})

    target_file = run_dir / "published_timetable.json"
    if not target_file.exists():
        target_file = run_dir / "baseline.json"

    if not target_file.exists():
        raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "No timetable found to export"}})

    with open(target_file, "r", encoding="utf-8") as f:
        tt = Timetable.model_validate_json(f.read())

    csv_rows = ["course_id,slot_id,room_ids"]
    for a in tt.assignments:
        rooms = ";".join(a.room_ids)
        csv_rows.append(f"{a.course_id},{a.slot_id},{rooms}")

    return Response(
        content="\n".join(csv_rows),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=quanta_timetable_{run_id}.csv"},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
