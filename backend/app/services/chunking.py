import subprocess
import re
import json
import logging
import os
from typing import List, Tuple, Dict, Any, Optional

logger = logging.getLogger(__name__)


class AudioValidationError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def plan_chunks(
    duration_sec: float,
    silences: List[Tuple[float, float]],
    target_sec: float = 25.0,
    min_sec: float = 18.0,
    max_sec: float = 30.0
) -> List[Tuple[float, float]]:
    """
    Pure planner function to slice audio of any length into chunks <= max_sec (30s).
    
    Strategy:
    - Moves forward from current_start (starts at 0.0).
    - If remaining audio <= max_sec, returns final chunk to duration_sec.
    - Looks for silence intervals that overlap or fall within the window [current_start + min_sec, current_start + max_sec].
    - Selects the silence midpoint closest to (current_start + target_sec).
    - If no suitable silence is found, makes a hard cut at (current_start + max_sec).
    - Guarantees 100% audio coverage with 0 gaps, and chunk length <= max_sec.
    """
    if duration_sec <= 0:
        return []
        
    if duration_sec <= max_sec:
        return [(0.0, round(duration_sec, 3))]

    chunks: List[Tuple[float, float]] = []
    current_start = 0.0

    while current_start < duration_sec:
        remaining = duration_sec - current_start
        if remaining <= max_sec:
            chunks.append((round(current_start, 3), round(duration_sec, 3)))
            break

        window_min = current_start + min_sec
        window_max = current_start + max_sec
        target_cut = current_start + target_sec

        # Find best silence point within [window_min, window_max]
        best_cut: Optional[float] = None
        best_diff = float("inf")

        for s_start, s_end in silences:
            # We look for silence regions that intersect with our candidate window
            # A good cut point is the midpoint of silence clamped to [window_min, window_max]
            mid = (s_start + s_end) / 2.0
            
            # If silence midpoint is in window
            if window_min <= mid <= window_max:
                diff = abs(mid - target_cut)
                if diff < best_diff:
                    best_diff = diff
                    best_cut = mid
            # If silence spans across window_min or window_max
            elif s_start <= window_max and s_end >= window_min:
                clamped_point = max(window_min, min(mid, window_max))
                diff = abs(clamped_point - target_cut)
                if diff < best_diff:
                    best_diff = diff
                    best_cut = clamped_point

        if best_cut is None:
            # No silence in window: hard cut at window_max
            best_cut = window_max

        # Ensure cut doesn't exceed duration
        best_cut = min(best_cut, duration_sec)
        
        # Ensure we made meaningful progress (> 1 second)
        if best_cut <= current_start + 1.0:
            best_cut = min(current_start + max_sec, duration_sec)

        chunks.append((round(current_start, 3), round(best_cut, 3)))
        current_start = best_cut

    return chunks


def probe_audio(file_path: str, max_duration_min: int = 120) -> Dict[str, Any]:
    """
    Runs ffprobe on the input file to verify audio streams, validity, and duration.
    Raises AudioValidationError on invalid audio or if duration exceeds limit.
    """
    if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
        raise AudioValidationError("INVALID_AUDIO", "The uploaded audio file is empty or missing.")

    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration,size,format_name:stream=codec_type,sample_rate,channels",
        "-of", "json",
        file_path
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(result.stdout)
    except subprocess.CalledProcessError as e:
        logger.error(f"ffprobe failed on {file_path}: {e.stderr}")
        raise AudioValidationError("INVALID_AUDIO", "Unable to read audio file. File may be corrupted or unsupported format.")
    except Exception as e:
        logger.error(f"Error parsing ffprobe output: {e}")
        raise AudioValidationError("INVALID_AUDIO", f"Corrupt or unreadable audio format: {str(e)}")

    streams = data.get("streams", [])
    audio_streams = [s for s in streams if s.get("codec_type") == "audio"]
    if not audio_streams:
        raise AudioValidationError("INVALID_AUDIO", "The file does not contain any valid audio streams.")

    format_info = data.get("format", {})
    duration_str = format_info.get("duration")
    if not duration_str:
        # Fallback to stream duration
        duration_str = audio_streams[0].get("duration")

    if not duration_str:
        raise AudioValidationError("INVALID_AUDIO", "Could not determine audio duration.")

    try:
        duration_sec = float(duration_str)
    except ValueError:
        raise AudioValidationError("INVALID_AUDIO", f"Invalid duration value: {duration_str}")

    if duration_sec <= 0.1:
        raise AudioValidationError("INVALID_AUDIO", "Audio duration is too short (< 0.1s).")

    if duration_sec > max_duration_min * 60:
        raise AudioValidationError(
            "TOO_LONG",
            f"Audio duration ({duration_sec / 60:.1f} min) exceeds maximum limit of {max_duration_min} minutes."
        )

    return {
        "duration_sec": duration_sec,
        "sample_rate": audio_streams[0].get("sample_rate"),
        "channels": audio_streams[0].get("channels"),
        "format_name": format_info.get("format_name")
    }


def normalize_to_wav(input_path: str, output_wav_path: str) -> None:
    """
    Converts any audio file to 16kHz mono 16-bit PCM WAV for uniform chunking and ASR compliance.
    """
    os.makedirs(os.path.dirname(output_wav_path), exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        output_wav_path
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg normalization failed: {e.stderr}")
        raise AudioValidationError("CORRUPT_AUDIO", f"Failed to normalize audio file: {e.stderr.strip()}")


def detect_silence(wav_path: str, noise_db: float = -30.0, min_duration: float = 0.3) -> List[Tuple[float, float]]:
    """
    Runs ffmpeg silencedetect filter and parses timestamps of silent regions.
    Returns list of (silence_start, silence_end) in seconds.
    """
    cmd = [
        "ffmpeg",
        "-i", wav_path,
        "-af", f"silencedetect=noise={noise_db}dB:d={min_duration}",
        "-f", "null",
        "-"
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        output = result.stderr

        silence_starts = []
        silence_ends = []
        silences = []

        start_pattern = re.compile(r"silence_start:\s*([0-9.]+)")
        end_pattern = re.compile(r"silence_end:\s*([0-9.]+)")

        current_start: Optional[float] = None
        for line in output.splitlines():
            start_match = start_pattern.search(line)
            if start_match:
                current_start = float(start_match.group(1))
            end_match = end_pattern.search(line)
            if end_match and current_start is not None:
                end_val = float(end_match.group(1))
                silences.append((current_start, end_val))
                current_start = None

        return silences
    except Exception as e:
        logger.warning(f"Silence detection encountered an error (will fallback to uniform cuts): {e}")
        return []


def extract_chunk_file(input_wav: str, start_sec: float, end_sec: float, output_chunk_path: str) -> None:
    """
    Extracts an exact audio chunk segment to a temporary WAV file.
    Clamps duration to strictly <= 28.5s with pcm_s16le encoding so that container
    padding or floating-point rounding never exceeds Gnani ASR's 30s hard limit.
    """
    os.makedirs(os.path.dirname(output_chunk_path), exist_ok=True)
    duration = min(end_sec - start_sec, 28.5)
    cmd = [
        "ffmpeg",
        "-y",
        "-ss", str(start_sec),
        "-t", str(duration),
        "-i", input_wav,
        "-c:a", "pcm_s16le",
        output_chunk_path
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg chunk extraction failed for {start_sec}-{end_sec}: {e.stderr}")
        raise RuntimeError(f"Failed to extract chunk {start_sec}-{end_sec}: {e.stderr.strip()}")
