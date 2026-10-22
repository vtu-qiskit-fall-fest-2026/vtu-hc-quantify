"""SQLAlchemy 2.0 SQLite database schema and persistence for asynchronous jobs.

Task: A5b (Member A: Classical core + backend)
Reference: docs/CONTRACTS.md Section 2 & 3, tasks/A_backend.md
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from sqlalchemy import Float, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from backend.schemas import Job

DB_PATH = Path(__file__).resolve().parent.parent.parent / "quanta_jobs.db"
ENGINE = create_engine(f"sqlite:///{DB_PATH}", echo=False, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)


class Base(DeclarativeBase):
    pass


class JobModel(Base):
    """SQLAlchemy model for asynchronous job tracking."""
    __tablename__ = "jobs"

    job_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    stage: Mapped[str] = mapped_column(String(64), nullable=False, default="init")
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    energy_trace_json: Mapped[str] = mapped_column(String, default="[]")
    result_ref: Mapped[str | None] = mapped_column(String(256), nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

    def to_schema(self) -> Job:
        try:
            trace = json.loads(self.energy_trace_json)
        except (json.JSONDecodeError, TypeError):
            trace = []
        return Job(
            job_id=self.job_id,
            kind=self.kind,
            status=self.status,
            stage=self.stage,
            progress=self.progress,
            energy_trace=trace,
            result_ref=self.result_ref,
            error=self.error,
        )


def init_db() -> None:
    """Creates database tables if not present."""
    Base.metadata.create_all(bind=ENGINE)


def cleanup_stale_jobs() -> None:
    """Cleans up any jobs stuck in running state from interrupted server processes."""
    init_db()
    with SessionLocal() as session:
        stale = session.query(JobModel).filter(JobModel.status == "running").all()
        for j in stale:
            j.status = "error"
            j.error = "Process interrupted / timed out"
        session.commit()



def create_job(
    job_id: str,
    kind: str,
    stage: str = "init",
    progress: float = 0.0,
    result_ref: str | None = None,
) -> Job:
    """Inserts a new job entry into the SQLite jobs table."""
    init_db()
    with SessionLocal() as session:
        job = JobModel(
            job_id=job_id,
            kind=kind,
            status="running",
            stage=stage,
            progress=progress,
            energy_trace_json="[]",
            result_ref=result_ref,
            error=None,
            created_at=time.time(),
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        return job.to_schema()


def update_job_progress(
    job_id: str,
    stage: str,
    progress: float,
    energy: float | None = None,
) -> None:
    """Thread-safe update of job stage, progress percentage, and incremental energy trace."""
    with SessionLocal() as session:
        job = session.get(JobModel, job_id)
        if not job:
            return
        job.stage = stage
        job.progress = float(progress)
        if energy is not None:
            try:
                trace: list[float] = json.loads(job.energy_trace_json)
            except (json.JSONDecodeError, TypeError):
                trace = []
            trace.append(float(energy))
            job.energy_trace_json = json.dumps(trace)
        session.commit()


def complete_job(
    job_id: str,
    result_ref: str | None = None,
    stage: str = "done",
) -> None:
    """Marks a job as done."""
    with SessionLocal() as session:
        job = session.get(JobModel, job_id)
        if not job:
            return
        job.status = "done"
        job.stage = stage
        job.progress = 1.0
        job.error = None
        if result_ref:
            job.result_ref = result_ref
        session.commit()


def fail_job(job_id: str, error_message: str) -> None:
    """Marks a job as failed with an error message."""
    with SessionLocal() as session:
        job = session.get(JobModel, job_id)
        if not job:
            return
        job.status = "error"
        job.stage = "error"
        job.error = error_message
        session.commit()


def get_job(job_id: str) -> Job | None:
    """Retrieves job state from the database."""
    init_db()
    with SessionLocal() as session:
        job = session.get(JobModel, job_id)
        if job:
            return job.to_schema()
        return None
