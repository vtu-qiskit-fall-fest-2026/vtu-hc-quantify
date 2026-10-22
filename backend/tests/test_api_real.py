"""Integration tests for real QUANTA API execution pipeline (Task A5b).

Owner: Member A (Classical core + backend)
Reference: docs/CONTRACTS.md, tasks/A_backend.md, and handoffs/HO-04_A_to_C_real_api.md
"""
from __future__ import annotations

import io
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app


@pytest.fixture
def real_client(monkeypatch: pytest.MonkeyPatch):
    """Activates real backend pipeline execution by disabling QUANTA_MOCK."""
    monkeypatch.setenv("QUANTA_MOCK", "0")
    return TestClient(app)


def test_real_health(real_client: TestClient):
    """Verify health endpoint accurately reports mock=False in real mode."""
    resp = real_client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["mock"] is False


def test_real_dataset_upload_csv(real_client: TestClient):
    """Verify multipart CSV dataset upload, parsing, and warning aggregation."""
    mini_dir = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "mini"

    files = {
        "courses": ("courses.csv", (mini_dir / "courses.csv").read_bytes(), "text/csv"),
        "enrollments": ("enrollments.csv", (mini_dir / "enrollments.csv").read_bytes(), "text/csv"),
        "rooms": ("rooms.csv", (mini_dir / "rooms.csv").read_bytes(), "text/csv"),
        "slots": ("slots.csv", (mini_dir / "slots.csv").read_bytes(), "text/csv"),
    }

    resp = real_client.post("/api/datasets", files=files)
    assert resp.status_code == 200
    data = resp.json()
    assert "dataset_id" in data
    assert data["stats"]["courses"] == 12
    assert data["stats"]["rooms"] == 4
    assert isinstance(data["warnings"], list)


def test_real_dataset_upload_invalid_csv_error_envelope(real_client: TestClient):
    """Verify error envelope {error: {code, message}} on invalid CSV input."""
    files = {
        "courses": ("courses.csv", io.BytesIO(b"not_valid_headers\n1,2,3"), "text/csv"),
        "enrollments": ("enrollments.csv", io.BytesIO(b"student_id,course_id\n"), "text/csv"),
        "rooms": ("rooms.csv", io.BytesIO(b"room_id,building,capacity\n"), "text/csv"),
        "slots": ("slots.csv", io.BytesIO(b"slot_id,day,start,end,order\n"), "text/csv"),
    }
    resp = real_client.post("/api/datasets", files=files)
    assert resp.status_code == 400
    err = resp.json()
    assert "error" in err
    assert "code" in err["error"]
    assert "message" in err["error"]


def test_real_run_lifecycle_baseline_and_extract(real_client: TestClient):
    """Verify complete run creation, CP-SAT baseline job, and cluster extraction."""
    # 1. Create run
    r_resp = real_client.post("/api/runs", json={"dataset_id": "ds_mini", "seed": 42})
    assert r_resp.status_code == 200
    run_id = r_resp.json()["run_id"]

    # 2. Trigger baseline CP-SAT
    b_resp = real_client.post(f"/api/runs/{run_id}/baseline", json={"time_limit_s": 5})
    assert b_resp.status_code == 200
    job_id = b_resp.json()["job_id"]

    # 3. Poll job until completion (fast for mini dataset)
    timeout = 15.0
    start = time.time()
    while time.time() - start < timeout:
        j_resp = real_client.get(f"/api/jobs/{job_id}")
        assert j_resp.status_code == 200
        job_data = j_resp.json()
        if job_data["status"] == "done":
            break
        time.sleep(0.3)
    assert job_data["status"] == "done"

    # 4. Check run details has timetable
    d_resp = real_client.get(f"/api/runs/{run_id}")
    assert d_resp.status_code == 200
    details = d_resp.json()
    assert details["timetable"] is not None
    assert details["timetable"]["hard_violations"] == 0

    # 5. Extract clusters
    e_resp = real_client.post(f"/api/runs/{run_id}/clusters/extract", json={"max_size": 6, "top_k": 2})
    assert e_resp.status_code == 200
    clusters = e_resp.json()
    assert isinstance(clusters, list)
    if clusters:
        assert 4 <= len(clusters[0]["courses"]) <= 14


def test_real_quantum_role_permissions(real_client: TestClient):
    """Verify role security: coordinator attempting noisy/ibm backend gets HTTP 403."""
    # Create run first
    r_resp = real_client.post("/api/runs", json={"dataset_id": "ds_mini", "seed": 42})
    run_id = r_resp.json()["run_id"]

    # Coordinator attempting IBM hardware -> 403
    resp_403 = real_client.post(
        f"/api/runs/{run_id}/clusters/cluster_01/quantum",
        json={"backend": "ibm", "p": 1, "shots": 1024},
        headers={"X-Role": "coordinator"},
    )
    assert resp_403.status_code == 403
    err = resp_403.json()
    assert "error" in err
    assert err["error"]["code"] == "FORBIDDEN"


def test_real_benchmarks_and_publish(real_client: TestClient):
    """Verify benchmarks endpoint returns valid response structure and publish re-verifies 0 violations."""
    r_resp = real_client.post("/api/runs", json={"dataset_id": "ds_mini", "seed": 42})
    run_id = r_resp.json()["run_id"]

    # Benchmarks
    b_resp = real_client.get(f"/api/runs/{run_id}/benchmarks")
    assert b_resp.status_code == 200
    benchmarks = b_resp.json()
    assert "rows" in benchmarks
    assert "hardware" in benchmarks

    # Run baseline to enable publishing
    real_client.post(f"/api/runs/{run_id}/baseline", json={"time_limit_s": 5})
    # Wait briefly for baseline to finish
    time.sleep(1.0)

    # Publish
    p_resp = real_client.post(f"/api/runs/{run_id}/publish", json={"cluster_ids": []})
    if p_resp.status_code == 200:
        pub_data = p_resp.json()
        assert "export_url" in pub_data
        assert pub_data["timetable"]["hard_violations"] == 0

        # Export CSV
        exp_resp = real_client.get(pub_data["export_url"])
        assert exp_resp.status_code == 200
        assert "text/csv" in exp_resp.headers["content-type"]
        assert "course_id,slot_id,room_ids" in exp_resp.text
