from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


# --- Error Envelopes ---
class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


# --- Uploads ---
class UploadInitRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    content_type: str = Field(..., min_length=3, max_length=100)
    size_bytes: int = Field(..., gt=0)
    language_code: str = Field(default="en-IN", max_length=20)


class UploadInitResponse(BaseModel):
    recording_id: UUID
    upload_url: str


class UploadCompleteResponse(BaseModel):
    status: str
    recording_id: UUID
    message: str = "Upload completed and processing job queued"


# --- Timed Segments & Summary ---
class TimedSegment(BaseModel):
    idx: int
    start_sec: float
    end_sec: float
    text: Optional[str] = None
    status: str


class SummaryContent(BaseModel):
    title: str = "Audio Summary"
    tldr: str = ""
    key_points: List[str] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list)


class ProgressInfo(BaseModel):
    chunks_done: int
    chunks_total: int


# --- Recordings ---
class RecordingListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    status: str
    stage: Optional[str] = None
    duration_sec: Optional[float] = None
    title: Optional[str] = None
    language_code: str
    created_at: datetime


class RecordingDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    content_type: str
    size_bytes: int
    language_code: str
    status: str
    stage: Optional[str] = None
    progress: ProgressInfo
    duration_sec: Optional[float] = None
    title: Optional[str] = None
    transcript_text: Optional[str] = None
    segments: List[TimedSegment] = Field(default_factory=list)
    summary_json: Optional[Any] = None
    summary_status: str
    transcript_status: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class RetryResponse(BaseModel):
    status: str
    recording_id: UUID
    message: str


class MessageResponse(BaseModel):
    message: str
