import os
import re
import uuid
import logging
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models import Recording, RecordingStatus, Stage, JobKind
from app.schemas import (
    UploadInitRequest,
    UploadInitResponse,
    UploadCompleteResponse,
    ErrorResponse,
    ErrorDetail
)
from app.services.storage import storage_service
from app.services.queue import enqueue_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["Uploads"])


def get_client_id(x_client_id: Optional[str] = Header(None)) -> str:
    """Dependency to extract and validate X-Client-Id header."""
    if not x_client_id or not x_client_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "MISSING_CLIENT_ID", "message": "X-Client-Id header is required."}}
        )
    return x_client_id.strip()


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal or malformed S3 keys."""
    base = os.path.basename(filename)
    return re.sub(r"[^a-zA-Z0-9._-]", "_", base)


@router.post(
    "/init",
    response_model=UploadInitResponse,
    responses={400: {"model": ErrorResponse}}
)
def init_upload(
    payload: UploadInitRequest,
    client_id: str = Depends(get_client_id),
    db: Session = Depends(get_db)
):
    """
    Initiates an audio upload session, performs validation, and returns a presigned S3 PUT URL.
    """
    ext = os.path.splitext(payload.filename.lower())[1]
    
    # 1. Validate extension
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_FILE_TYPE",
                    "message": f"Unsupported file extension '{ext}'. Allowed: {', '.join(sorted(settings.ALLOWED_EXTENSIONS))}"
                }
            }
        )

    # 2. Validate content type (permissive check)
    if payload.content_type.lower() not in settings.ALLOWED_CONTENT_TYPES and not payload.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_CONTENT_TYPE",
                    "message": f"Unsupported content type '{payload.content_type}'. Must be a valid audio MIME type."
                }
            }
        )

    # 3. Validate size
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if payload.size_bytes > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "FILE_TOO_LARGE",
                    "message": f"File size ({payload.size_bytes / (1024 * 1024):.1f} MB) exceeds limit of {settings.MAX_UPLOAD_MB} MB."
                }
            }
        )

    # 4. Validate language code
    if payload.language_code not in settings.SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "UNSUPPORTED_LANGUAGE",
                    "message": f"Language '{payload.language_code}' is not supported. Supported: {', '.join(settings.SUPPORTED_LANGUAGES)}"
                }
            }
        )

    # 5. Create recording record
    recording_id = uuid.uuid4()
    clean_filename = sanitize_filename(payload.filename)
    storage_key = f"recordings/{client_id}/{recording_id}/{clean_filename}"

    recording = Recording(
        id=recording_id,
        client_id=client_id,
        filename=clean_filename,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        storage_key=storage_key,
        language_code=payload.language_code,
        status=RecordingStatus.UPLOADING
    )
    db.add(recording)
    db.commit()

    # 6. Generate presigned PUT URL
    upload_url = storage_service.generate_presigned_upload_url(
        key=storage_key,
        content_type=payload.content_type
    )

    return UploadInitResponse(
        recording_id=recording_id,
        upload_url=upload_url
    )


@router.post(
    "/{id}/complete",
    response_model=UploadCompleteResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        404: {"model": ErrorResponse},
        409: {"model": ErrorResponse}
    }
)
def complete_upload(
    id: uuid.UUID,
    client_id: str = Depends(get_client_id),
    db: Session = Depends(get_db)
):
    """
    Confirms that client upload to S3 completed, verifies object existence with HEAD,
    and queues background transcription.
    """
    recording = db.scalars(
        select(Recording).where(Recording.id == id, Recording.client_id == client_id)
    ).first()

    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "RECORDING_NOT_FOUND", "message": "Recording not found for this client."}}
        )

    # Verify object in bucket via HEAD
    head_meta = storage_service.head_object(recording.storage_key)
    if not head_meta:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "UPLOAD_MISSING",
                    "message": "Uploaded audio object could not be found in storage. Please try uploading again."
                }
            }
        )

    # Transition status to QUEUED and queue worker job
    recording.status = RecordingStatus.QUEUED
    recording.stage = Stage.VALIDATING
    db.commit()

    enqueue_job(db, recording_id=recording.id, kind=JobKind.PROCESS_RECORDING)

    return UploadCompleteResponse(
        status=RecordingStatus.QUEUED,
        recording_id=recording.id,
        message="Upload completed successfully. Processing job queued."
    )
