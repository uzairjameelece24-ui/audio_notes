import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, update

from app.database import get_db
from app.models import (
    Recording,
    Chunk,
    Job,
    RecordingStatus,
    Stage,
    TranscriptStatus,
    SummaryStatus,
    ChunkStatus,
    JobKind
)
from app.schemas import (
    RecordingListItem,
    RecordingDetailResponse,
    TimedSegment,
    ProgressInfo,
    RetryResponse,
    MessageResponse,
    ErrorResponse
)
from app.services.storage import storage_service
from app.services.queue import enqueue_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recordings", tags=["Recordings"])


def get_client_id(x_client_id: Optional[str] = Header(None)) -> str:
    """Dependency to extract and validate X-Client-Id header."""
    if not x_client_id or not x_client_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "MISSING_CLIENT_ID", "message": "X-Client-Id header is required."}}
        )
    return x_client_id.strip()


@router.get("", response_model=List[RecordingListItem])
def list_recordings(
    client_id: str = Depends(get_client_id),
    db: Session = Depends(get_db)
):
    """
    Returns list of recordings owned by this client, ordered newest first.
    """
    recordings = db.scalars(
        select(Recording)
        .where(Recording.client_id == client_id)
        .order_by(Recording.created_at.desc())
    ).all()
    return recordings


@router.get(
    "/{id}",
    response_model=RecordingDetailResponse,
    responses={404: {"model": ErrorResponse}}
)
def get_recording_detail(
    id: uuid.UUID,
    client_id: str = Depends(get_client_id),
    db: Session = Depends(get_db)
):
    """
    Returns full recording details including live progress, chunk segments, transcript, and summary.
    """
    recording = db.scalars(
        select(Recording).where(Recording.id == id, Recording.client_id == client_id)
    ).first()

    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "RECORDING_NOT_FOUND", "message": "Recording not found."}}
        )

    # Fetch chunks to compute progress and segments
    chunks = db.scalars(
        select(Chunk).where(Chunk.recording_id == id).order_by(Chunk.idx)
    ).all()

    chunks_total = len(chunks)
    chunks_done = sum(1 for c in chunks if c.status == ChunkStatus.DONE)

    segments = [
        TimedSegment(
            idx=c.idx,
            start_sec=c.start_sec,
            end_sec=c.end_sec,
            text=c.text,
            status=c.status
        )
        for c in chunks
    ]

    return RecordingDetailResponse(
        id=recording.id,
        filename=recording.filename,
        content_type=recording.content_type,
        size_bytes=recording.size_bytes,
        language_code=recording.language_code,
        status=recording.status,
        stage=recording.stage,
        progress=ProgressInfo(chunks_done=chunks_done, chunks_total=chunks_total),
        duration_sec=recording.duration_sec,
        title=recording.title,
        transcript_text=recording.transcript_text,
        segments=segments,
        summary_json=recording.summary_json,
        summary_status=recording.summary_status,
        transcript_status=recording.transcript_status,
        error_code=recording.error_code,
        error_message=recording.error_message,
        created_at=recording.created_at,
        updated_at=recording.updated_at
    )


@router.post(
    "/{id}/retry",
    response_model=RetryResponse,
    responses={
        400: {"model": ErrorResponse},
        404: {"model": ErrorResponse}
    }
)
def retry_recording(
    id: uuid.UUID,
    client_id: str = Depends(get_client_id),
    db: Session = Depends(get_db)
):
    """
    Re-queues only what failed: failed chunks and/or failed summary.
    """
    recording = db.scalars(
        select(Recording).where(Recording.id == id, Recording.client_id == client_id)
    ).first()

    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "RECORDING_NOT_FOUND", "message": "Recording not found."}}
        )

    chunks = db.scalars(
        select(Chunk).where(Chunk.recording_id == id).order_by(Chunk.idx)
    ).all()

    failed_chunks = [c for c in chunks if c.status == ChunkStatus.FAILED]

    # Scenario 1: Some or all chunks failed -> retry chunk transcription
    if failed_chunks or recording.transcript_status in [TranscriptStatus.PARTIAL, TranscriptStatus.FAILED]:
        # Reset failed chunks to PENDING
        for c in failed_chunks:
            c.status = ChunkStatus.PENDING
            c.error = None

        recording.status = RecordingStatus.QUEUED
        recording.stage = Stage.TRANSCRIBING
        recording.error_code = None
        recording.error_message = None
        db.commit()

        enqueue_job(db, recording_id=recording.id, kind=JobKind.PROCESS_RECORDING)
        return RetryResponse(
            status=RecordingStatus.QUEUED,
            recording_id=recording.id,
            message="Re-queued failed chunks for transcription."
        )

    # Scenario 2: Chunks succeeded but summary failed -> retry summary only
    if recording.summary_status == SummaryStatus.FAILED and recording.transcript_text:
        recording.status = RecordingStatus.QUEUED
        recording.stage = Stage.SUMMARIZING
        recording.summary_status = SummaryStatus.PENDING
        recording.error_message = None
        db.commit()

        enqueue_job(db, recording_id=recording.id, kind=JobKind.SUMMARIZE)
        return RetryResponse(
            status=RecordingStatus.QUEUED,
            recording_id=recording.id,
            message="Re-queued summary generation."
        )

    # Scenario 3: Whole recording failed early (e.g. validation/network) -> retry full process
    if recording.status == RecordingStatus.FAILED:
        for c in chunks:
            c.status = ChunkStatus.PENDING
            c.error = None
        recording.status = RecordingStatus.QUEUED
        recording.stage = Stage.VALIDATING
        recording.error_code = None
        recording.error_message = None
        db.commit()

        enqueue_job(db, recording_id=recording.id, kind=JobKind.PROCESS_RECORDING)
        return RetryResponse(
            status=RecordingStatus.QUEUED,
            recording_id=recording.id,
            message="Re-queued recording for full processing."
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail={"error": {"code": "NOT_RETRYABLE", "message": "Recording is not currently in a failed state."}}
    )


@router.delete(
    "/{id}",
    response_model=MessageResponse,
    responses={404: {"model": ErrorResponse}}
)
def delete_recording(
    id: uuid.UUID,
    client_id: str = Depends(get_client_id),
    db: Session = Depends(get_db)
):
    """
    Deletes recording, its chunk and job records, and deletes original file from S3 bucket.
    """
    recording = db.scalars(
        select(Recording).where(Recording.id == id, Recording.client_id == client_id)
    ).first()

    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "RECORDING_NOT_FOUND", "message": "Recording not found."}}
        )

    # Delete S3 object
    storage_service.delete_object(recording.storage_key)

    # Delete DB row (cascades to chunks and jobs)
    db.delete(recording)
    db.commit()

    return MessageResponse(message="Recording deleted successfully.")
