import pytest
from app.services.chunking import plan_chunks


def test_short_audio_single_chunk():
    """Audio shorter than max_sec (30s) should yield a single chunk."""
    chunks = plan_chunks(duration_sec=15.4, silences=[])
    assert len(chunks) == 1
    assert chunks[0] == (0.0, 15.4)


def test_chunking_with_silence_in_target_window():
    """Audio should cut at the silence midpoint closest to target_sec (25s) within [18s, 30s]."""
    # Silence from 24.0s to 25.0s (midpoint 24.5s)
    silences = [(24.0, 25.0), (48.0, 49.0)]
    duration = 60.0
    chunks = plan_chunks(duration_sec=duration, silences=silences)
    
    assert len(chunks) >= 2
    # First chunk cut should be at silence midpoint 24.5
    assert chunks[0] == (0.0, 24.5)
    # Ensure every chunk is <= 30s
    for start, end in chunks:
        assert (end - start) <= 30.0
        assert end > start


def test_chunking_without_silence_hard_cuts():
    """When no silence is found within [18s, 30s], planner must hard-cut at 30.0s."""
    duration = 75.0
    chunks = plan_chunks(duration_sec=duration, silences=[])
    
    assert len(chunks) == 3
    assert chunks[0] == (0.0, 30.0)
    assert chunks[1] == (30.0, 60.0)
    assert chunks[2] == (60.0, 75.0)


def test_chunking_ignores_out_of_window_silences():
    """Silences outside the [18s, 30s] relative window should be ignored."""
    # Silence at 5s (too early) and at 35s (too late for first chunk)
    silences = [(5.0, 6.0), (35.0, 36.0)]
    chunks = plan_chunks(duration_sec=50.0, silences=silences)
    
    # First cut must hard-cut at 30.0s
    assert chunks[0] == (0.0, 30.0)
    assert chunks[1] == (30.0, 50.0)


def test_full_coverage_and_no_gaps():
    """Planner must guarantee complete duration coverage with 0 gaps or overlaps."""
    duration = 178.5
    silences = [(23.0, 24.0), (49.0, 50.0), (74.0, 75.0), (98.0, 99.0), (124.0, 125.0), (150.0, 151.0)]
    chunks = plan_chunks(duration_sec=duration, silences=silences)
    
    assert chunks[0][0] == 0.0
    assert chunks[-1][1] == 178.5

    for i in range(len(chunks) - 1):
        # End of chunk i equals start of chunk i+1
        assert abs(chunks[i][1] - chunks[i+1][0]) < 1e-5
        # Each chunk is <= 30 seconds
        assert (chunks[i][1] - chunks[i][0]) <= 30.0

    assert (chunks[-1][1] - chunks[-1][0]) <= 30.0
