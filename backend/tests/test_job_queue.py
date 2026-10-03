import pytest
import uuid
from datetime import datetime, timezone, timedelta
from app.database import SessionLocal
from app.models import Recording, Job, JobStatus, JobKind, RecordingStatus
from app.services.queue import enqueue_job, claim_next_job, update_job_heartbeat, mark_job_completed, mark_job_failed


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def sample_recording(db):
    rec = Recording(
        id=uuid.uuid4(),
        client_id="test-client-123",
        filename="test.wav",
        content_type="audio/wav",
        size_bytes=1024,
        storage_key="recordings/test-client-123/test.wav",
        language_code="en-IN",
        status=RecordingStatus.QUEUED
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    yield rec
    # Cleanup
    db.delete(rec)
    db.commit()


def test_enqueue_and_claim_job(db, sample_recording):
    """Verify enqueuing a job and claiming it via SELECT FOR UPDATE SKIP LOCKED."""
    job = enqueue_job(db, sample_recording.id, kind=JobKind.PROCESS_RECORDING)
    assert job.status == JobStatus.QUEUED
    assert job.attempts == 0

    claimed = claim_next_job(db)
    assert claimed is not None
    assert claimed.id == job.id
    assert claimed.status == JobStatus.RUNNING
    assert claimed.attempts == 1
    assert claimed.heartbeat_at is not None

    # Claiming again when queue is empty should return None
    claimed_again = claim_next_job(db)
    # Could be None or another queued job if present
    if claimed_again:
        assert claimed_again.id != job.id

    # Mark completed
    mark_job_completed(db, job.id)
    db.refresh(job)
    assert job.status == JobStatus.DONE


def test_stale_heartbeat_recovery(db, sample_recording):
    """Jobs with stale heartbeat (> 2 mins) should be automatically recovered to QUEUED."""
    job = enqueue_job(db, sample_recording.id, kind=JobKind.PROCESS_RECORDING)
    
    # Simulate a crashed worker whose heartbeat was 5 minutes ago
    stale_time = datetime.now(timezone.utc) - timedelta(minutes=5)
    job.status = JobStatus.RUNNING
    job.heartbeat_at = stale_time
    db.commit()

    # Next claim should reclaim the stale job back to QUEUED and pick it up
    claimed = claim_next_job(db)
    assert claimed is not None
    assert claimed.id == job.id
    assert claimed.status == JobStatus.RUNNING
    assert claimed.attempts == 1

    mark_job_completed(db, job.id)
