"""QUANTA FastAPI application and REST API routes."""
from __future__ import annotations

import os
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from backend.schemas import Job, QuantumConfig

app = FastAPI(
    title="QUANTA API",
    description="Hybrid CP-SAT + QAOA university examination timetabling platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IS_MOCK = os.getenv("QUANTA_MOCK", "0") == "1"


@app.get("/api/health")
def health():
    return {"status": "ok", "mock": IS_MOCK, "version": "1.0.0"}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    return {
        "run_id": run_id,
        "status": "ready",
        "mock": IS_MOCK,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("backend.api.main:app", host="0.0.0.0", port=port, reload=True)
