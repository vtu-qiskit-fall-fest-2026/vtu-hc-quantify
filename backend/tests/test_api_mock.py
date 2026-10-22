"""Unit tests for FastAPI Mock Mode API endpoints (Task A5a)."""
import pytest
from fastapi.testclient import TestClient

from backend.api.main import app


@pytest.fixture(autouse=True)
def mock_env(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("QUANTA_MOCK", "1")


client = TestClient(app)


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["mock"] is True


def test_datasets_upload():
    resp = client.post("/api/datasets")
    assert resp.status_code == 200
    data = resp.json()
    assert data["dataset_id"] == "ds_mini"
    assert data["stats"]["courses"] == 12


def test_run_lifecycle_and_baseline():
    # 1. Create run
    r_resp = client.post("/api/runs", json={"dataset_id": "ds_mini", "seed": 42})
    assert r_resp.status_code == 200
    run_id = r_resp.json()["run_id"]

    # 2. Trigger baseline
    b_resp = client.post(f"/api/runs/{run_id}/baseline", json={"time_limit_s": 60})
    assert b_resp.status_code == 200
    job_id = b_resp.json()["job_id"]

    # 3. Check run details
    d_resp = client.get(f"/api/runs/{run_id}")
    assert d_resp.status_code == 200
    run_data = d_resp.json()
    assert run_data["timetable"]["hard_violations"] == 0
    assert len(run_data["clusters"]) > 0


def test_cluster_extraction():
    resp = client.post("/api/runs/run_test/clusters/extract", json={"max_size": 12, "top_k": 5})
    assert resp.status_code == 200
    clusters = resp.json()
    assert len(clusters) > 0
    assert clusters[0]["cluster_id"] == "cluster_01"


def test_quantum_role_permissions():
    # Coordinator attempting to access physical IBM hardware -> 403 Forbidden
    resp_forbidden = client.post(
        "/api/runs/run_test/clusters/cluster_01/quantum",
        json={"backend": "ibm", "p": 1, "shots": 1024},
        headers={"X-Role": "coordinator"},
    )
    assert resp_forbidden.status_code == 403

    # Coordinator accessing ideal simulator -> 200 Allowed
    resp_ideal = client.post(
        "/api/runs/run_test/clusters/cluster_01/quantum",
        json={"backend": "ideal", "p": 1, "shots": 1024},
        headers={"X-Role": "coordinator"},
    )
    assert resp_ideal.status_code == 200

    # Researcher accessing physical IBM hardware -> 200 Allowed
    resp_researcher = client.post(
        "/api/runs/run_test/clusters/cluster_01/quantum",
        json={"backend": "ibm", "p": 1, "shots": 1024},
        headers={"X-Role": "researcher"},
    )
    assert resp_researcher.status_code == 200
    job_id = resp_researcher.json()["job_id"]

    # Check job polling
    job_resp = client.get(f"/api/jobs/{job_id}")
    assert job_resp.status_code == 200


def test_cluster_result_and_publish():
    # Get cluster result
    r_resp = client.get("/api/runs/run_test/clusters/cluster_01/result")
    assert r_resp.status_code == 200
    res = r_resp.json()
    assert "quantum" in res
    assert "decision" in res
    assert res["decision"]["hard_violations"] == 0

    # Benchmarks
    b_resp = client.get("/api/runs/run_test/benchmarks")
    assert b_resp.status_code == 200
    assert len(b_resp.json()["rows"]) > 0

    # Publish
    p_resp = client.post("/api/runs/run_test/publish", json={"cluster_ids": ["cluster_01"]})
    assert p_resp.status_code == 200
    assert "export_url" in p_resp.json()

    # CSV Export
    csv_resp = client.get("/api/runs/run_test/export.csv")
    assert csv_resp.status_code == 200
    assert "course_id,slot_id,room_ids" in csv_resp.text


if __name__ == "__main__":
    test_health()
    test_datasets_upload()
    test_run_lifecycle_and_baseline()
    test_cluster_extraction()
    test_quantum_role_permissions()
    test_cluster_result_and_publish()
    print("All mock API tests passed successfully!")
