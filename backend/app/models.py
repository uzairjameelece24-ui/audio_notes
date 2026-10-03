import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    BigInteger,
    Float,
    Text,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    JSON,
    func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class RecordingStatus:
    UPLOADING = "UPLOADING"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Stage:
    VALIDATING = "validating"
    CHUNKING = "chunking"
    TRANSCRIBING = "transcribing"
    SUMMARIZING = "summarizing"


class TranscriptStatus:
    PENDING = "PENDING"
    DONE = "DONE"
    PARTIAL = "PARTIAL"
    FAILED = "FAILED"


class SummaryStatus:
    PENDING = "PENDING"
    DONE = "DONE"
    FAILED = "FAILED"


class ChunkStatus:
    PENDING = "PENDING"
    DONE = "DONE"
    FAILED = "FAILED"


class JobStatus:
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"


class JobKind:
    PROCESS_RECORDING = "process_recording"
    SUMMARIZE = "summarize"


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(String(255), index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    storage_key = Column(String(500), nullable=False)
    language_code = Column(String(20), nullable=False, default="en-IN")

    status = Column(String(50), nullable=False, default=RecordingStatus.UPLOADING)
    stage = Column(String(50), nullable=True)
    duration_sec = Column(Float, nullable=True)
    title = Column(String(255), nullable=True)

    transcript_text = Column(Text, nullable=True)
    transcript_status = Column(String(50), nullable=False, default=TranscriptStatus.PENDING)

    # Use JSON with fallback to JSONB
    summary_json = Column(JSON, nullable=True)
    summary_status = Column(String(50), nullable=False, default=SummaryStatus.PENDING)

    error_code = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    chunks = relationship("Chunk", back_populates="recording", cascade="all, delete-orphan", order_by="Chunk.idx")
    jobs = relationship("Job", back_populates="recording", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recording_id = Column(UUID(as_uuid=True), ForeignKey("recordings.id", ondelete="CASCADE"), nullable=False, index=True)
    idx = Column(Integer, nullable=False)
    start_sec = Column(Float, nullable=False)
    end_sec = Column(Float, nullable=False)
    status = Column(String(50), nullable=False, default=ChunkStatus.PENDING)
    text = Column(Text, nullable=True)
    attempts = Column(Integer, nullable=False, default=0)
    error = Column(Text, nullable=True)

    recording = relationship("Recording", back_populates="chunks")

    __table_args__ = (
        UniqueConstraint("recording_id", "idx", name="uq_recording_chunk_idx"),
    )


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind = Column(String(50), nullable=False)  # process_recording | summarize
    recording_id = Column(UUID(as_uuid=True), ForeignKey("recordings.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default=JobStatus.QUEUED)
    attempts = Column(Integer, nullable=False, default=0)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    heartbeat_at = Column(DateTime(timezone=True), nullable=True)
    run_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    recording = relationship("Recording", back_populates="jobs")
