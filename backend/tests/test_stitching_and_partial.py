import pytest
import uuid
from app.models import Recording, Chunk, ChunkStatus, TranscriptStatus, RecordingStatus
from app.worker import format_timestamp


def test_format_timestamp():
    assert format_timestamp(0) == "0:00"
    assert format_timestamp(25.4) == "0:25"
    assert format_timestamp(125.0) == "2:05"
    assert format_timestamp(3665.0) == "1:01:05"


def test_stitching_with_partial_failures():
    """Test stitching chunks where some succeeded and some failed."""
    chunks = [
        Chunk(id=uuid.uuid4(), idx=0, start_sec=0.0, end_sec=24.5, status=ChunkStatus.DONE, text="Hello and welcome."),
        Chunk(id=uuid.uuid4(), idx=1, start_sec=24.5, end_sec=49.0, status=ChunkStatus.FAILED, error="ASR timeout"),
        Chunk(id=uuid.uuid4(), idx=2, start_sec=49.0, end_sec=70.0, status=ChunkStatus.DONE, text="Let's wrap up."),
    ]

    transcript_segments = []
    failed_chunks = [c for c in chunks if c.status == ChunkStatus.FAILED]
    for c in chunks:
        if c.status == ChunkStatus.DONE and c.text:
            transcript_segments.append(c.text.strip())
        elif c.status == ChunkStatus.FAILED:
            marker = f"[could not transcribe {format_timestamp(c.start_sec)}-{format_timestamp(c.end_sec)}]"
            transcript_segments.append(marker)

    stitched_text = "\n\n".join(transcript_segments)
    
    assert "Hello and welcome." in stitched_text
    assert "[could not transcribe 0:24-0:49]" in stitched_text
    assert "Let's wrap up." in stitched_text
    assert len(failed_chunks) == 1
