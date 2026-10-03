import uuid
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional
from sqlalchemy import select, update, or_, and_, func
from sqlalchemy.orm import Session
from app.models import Job, JobStatus, JobKind

logger = logging.getLogger(__name__)

STALE_HEARTBEAT_MINUTES = 2


def enqueue_job(
    db: Session,
    recording_id: uuid.UUID,
    kind: str = JobKind.PROCESS_RECORDING
) -> Job:
    """
    Insert a new queued job for a recording.
    """
    job = Job(
        id=uuid.uuid4(),
        kind=kind,
        recording_id=recording_id,
        status=JobStatus.QUEUED,
        attempts=0,
        run_at=datetime.now(timezone.utc)
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    logger.info(f"Enqueued job {job.id} (kind={kind}) for recording {recording_id}")
    return job


def claim_next_job(db: Session) -> Optional[Job]:
    """
    Atomically claims the next available job using SELECT ... FOR UPDATE SKIP LOCKED.
    Also recovers stale running jobs whose heartbeat has not been updated in > 2 minutes.
    """
    now = datetime.now(timezone.utc)
    stale_threshold = now - timedelta(minutes=STALE_HEARTBEAT_MINUTES)

    # Reclaim stale running jobs first
    stale_jobs_stmt = (
        update(Job)
        .where(
            Job.status == JobStatus.RUNNING,
            or_(
                Job.heartbeat_at < stale_threshold,
                Job.heartbeat_at.is_(None)
            )
        )
        .values(
            status=JobStatus.QUEUED,
            last_error="Recovered from stale worker heartbeat timeout"
        )
    )
    res = db.execute(stale_jobs_stmt)
    if res.rowcount > 0:
        db.commit()
        logger.warning(f"Reclaimed {res.rowcount} stale job(s) back to QUEUED status.")

    # Claim next QUEUED job where run_at <= now
    stmt = (
        select(Job)
        .where(
            Job.status == JobStatus.QUEUED,
            Job.run_at <= now
        )
        .order_by(Job.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    job = db.scalars(stmt).first()
    if job:
        job.status = JobStatus.RUNNING
        job.locked_at = now
        job.heartbeat_at = now
        job.attempts += 1
        db.commit()
        db.refresh(job)
        logger.info(f"Worker claimed job {job.id} (kind={job.kind}, recording={job.recording_id}, attempt={job.attempts})")
        return job

    return None


def update_job_heartbeat(db: Session, job_id: uuid.UUID) -> None:
    """
    Updates the heartbeat timestamp for a running job to prevent it from being reclaimed.
    """
    now = datetime.now(timezone.utc)
    db.execute(
        update(Job)
        .where(Job.id == job_id, Job.status == JobStatus.RUNNING)
        .values(heartbeat_at=now)
    )
    db.commit()


def mark_job_completed(db: Session, job_id: uuid.UUID) -> None:
    """
    Marks a job as DONE.
    """
    db.execute(
        update(Job)
        .where(Job.id == job_id)
        .values(status=JobStatus.DONE, heartbeat_at=datetime.now(timezone.utc))
    )
    db.commit()


def mark_job_failed(db: Session, job_id: uuid.UUID, error_msg: str) -> None:
    """
    Marks a job as FAILED with an error message.
    """
    db.execute(
        update(Job)
        .where(Job.id == job_id)
        .values(
            status=JobStatus.FAILED,
            last_error=error_msg,
            heartbeat_at=datetime.now(timezone.utc)
        )
    )
    db.commit()
