import os
import sys
import time
import shutil
import logging
import tempfile
import threading
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import (
    Recording,
    Chunk,
    Job,
    RecordingStatus,
    Stage,
    TranscriptStatus,
    SummaryStatus,
    ChunkStatus,
    JobStatus,
    JobKind
)
from app.services.storage import storage_service
from app.services.chunking import (
    probe_audio,
    normalize_to_wav,
    detect_silence,
    plan_chunks,
    extract_chunk_file,
    AudioValidationError
)
from app.services.asr import asr_client, ASRError, ASRAuthError
from app.services.llm import llm_service, LLMError
from app.services.queue import (
    claim_next_job,
    update_job_heartbeat,
    mark_job_completed,
    mark_job_failed
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [Worker] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("worker")


def format_timestamp(sec: float) -> str:
    """Format seconds into M:SS or H:MM:SS format."""
    total_sec = int(sec)
    m, s = divmod(total_sec, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


class HeartbeatThread(threading.Thread):
    """
    Background daemon thread that periodically touches the job's heartbeat_at in Postgres.
    """
    def __init__(self, job_id: UUID, interval_sec: float = 15.0):
        super().__init__(daemon=True)
        self.job_id = job_id
        self.interval_sec = interval_sec
        self.stop_event = threading.Event()

    def run(self):
        while not self.stop_event.is_set():
            self.stop_event.wait(self.interval_sec)
            if self.stop_event.is_set():
                break
            try:
                with SessionLocal() as db:
                    update_job_heartbeat(db, self.job_id)
            except Exception as e:
                logger.warning(f"Failed to update heartbeat for job {self.job_id}: {e}")

    def stop(self):
        self.stop_event.set()


def process_transcribe_chunk_task(
    chunk_id: UUID,
    recording_id: UUID,
    idx: int,
    start_sec: float,
    end_sec: float,
    normalized_wav_path: str,
    temp_dir: str,
    language_code: str
) -> Tuple[UUID, bool, Optional[str], Optional[str]]:
    """
    Helper function executed in thread pool for a single chunk:
    - Extracts chunk WAV
    - Calls ASR client
    - Updates chunk in database immediately
    """
    chunk_wav_path = os.path.join(temp_dir, f"chunk_{idx}_{start_sec:.2f}_{end_sec:.2f}.wav")
    extracted = False
    try:
        extract_chunk_file(normalized_wav_path, start_sec, end_sec, chunk_wav_path)
        extracted = True
        
        text = asr_client.transcribe_chunk(
            chunk_file_path=chunk_wav_path,
            language_code=language_code,
            chunk_idx=idx
        )
        
        # Save success to DB immediately
        with SessionLocal() as db:
            db.execute(
                update(Chunk)
                .where(Chunk.id == chunk_id)
                .values(
                    status=ChunkStatus.DONE,
                    text=text,
                    attempts=Chunk.attempts + 1,
                    error=None
                )
            )
            db.commit()
            
        logger.info(f"Chunk {idx} [{start_sec:.1f}s - {end_sec:.1f}s] completed successfully.")
        return chunk_id, True, text, None

    except Exception as e:
        err_msg = str(e)
        logger.warning(f"Chunk {idx} [{start_sec:.1f}s - {end_sec:.1f}s] failed: {err_msg}")
        
        with SessionLocal() as db:
            db.execute(
                update(Chunk)
                .where(Chunk.id == chunk_id)
                .values(
                    status=ChunkStatus.FAILED,
                    error=err_msg,
                    attempts=Chunk.attempts + 1
                )
            )
            db.commit()
            
        return chunk_id, False, None, err_msg
    finally:
        if extracted and os.path.exists(chunk_wav_path):
            try:
                os.remove(chunk_wav_path)
            except OSError:
                pass


def handle_process_recording_job(job: Job) -> None:
    """
    Full pipeline execution for process_recording job.
    """
    recording_id = job.recording_id
    temp_dir = tempfile.mkdtemp(prefix=f"audio_notes_{recording_id}_")
    
    heartbeat = HeartbeatThread(job.id)
    heartbeat.start()

    try:
        with SessionLocal() as db:
            recording = db.get(Recording, recording_id)
            if not recording:
                logger.error(f"Recording {recording_id} not found in database.")
                mark_job_failed(db, job.id, "Recording not found")
                return

            filename = recording.filename
            storage_key = recording.storage_key
            language_code = recording.language_code

            # Set status to PROCESSING, stage validating
            recording.status = RecordingStatus.PROCESSING
            recording.stage = Stage.VALIDATING
            recording.error_code = None
            recording.error_message = None
            db.commit()

        # Step 1: Download original audio from bucket
        original_ext = os.path.splitext(filename)[1] or ".bin"
        download_path = os.path.join(temp_dir, f"original{original_ext}")
        
        logger.info(f"Downloading {storage_key} to {download_path}...")
        download_ok = storage_service.download_file(storage_key, download_path)
        if not download_ok:
            raise RuntimeError(f"Failed to download audio from storage key: {storage_key}")

        # Check for corrupt audio failure injection
        if "corrupt_audio" in settings.fail_inject_set:
            logger.warning("[FAIL_INJECT] Simulating corrupt audio file")
            raise AudioValidationError("CORRUPT_AUDIO", "Simulated corrupt audio: file headers invalid or missing stream.")

        # Step 2: ffprobe validation
        probe_info = probe_audio(download_path, max_duration_min=settings.MAX_DURATION_MIN)
        duration_sec = probe_info["duration_sec"]
        logger.info(f"Audio validated: duration={duration_sec:.2f}s, format={probe_info.get('format_name')}")

        with SessionLocal() as db:
            db.execute(
                update(Recording)
                .where(Recording.id == recording_id)
                .values(duration_sec=duration_sec, stage=Stage.CHUNKING)
            )
            db.commit()

        # Step 3: Normalize to 16kHz mono WAV & plan chunks
        norm_wav_path = os.path.join(temp_dir, "normalized.wav")
        logger.info(f"Normalizing audio to 16kHz mono WAV: {norm_wav_path}")
        normalize_to_wav(download_path, norm_wav_path)

        # Detect silence & calculate chunk boundaries
        silences = detect_silence(norm_wav_path)
        chunk_ranges = plan_chunks(
            duration_sec=duration_sec,
            silences=silences,
            target_sec=settings.CHUNK_TARGET_SEC,
            min_sec=settings.CHUNK_MIN_SEC,
            max_sec=settings.CHUNK_MAX_SEC
        )
        logger.info(f"Planned {len(chunk_ranges)} chunk(s) for audio of {duration_sec:.2f}s")

        # Create or sync chunk records in DB
        with SessionLocal() as db:
            existing_chunks = db.scalars(
                select(Chunk).where(Chunk.recording_id == recording_id).order_by(Chunk.idx)
            ).all()

            if not existing_chunks:
                for idx, (c_start, c_end) in enumerate(chunk_ranges):
                    chunk_obj = Chunk(
                        recording_id=recording_id,
                        idx=idx,
                        start_sec=c_start,
                        end_sec=c_end,
                        status=ChunkStatus.PENDING,
                        attempts=0
                    )
                    db.add(chunk_obj)
                db.commit()

            # Set stage to transcribing
            db.execute(
                update(Recording)
                .where(Recording.id == recording_id)
                .values(stage=Stage.TRANSCRIBING)
            )
            db.commit()

        # Step 4: Transcribe chunks in parallel
        with SessionLocal() as db:
            pending_chunks = db.scalars(
                select(Chunk)
                .where(
                    Chunk.recording_id == recording_id,
                    Chunk.status != ChunkStatus.DONE
                )
                .order_by(Chunk.idx)
            ).all()
            pending_data = [(c.id, c.idx, c.start_sec, c.end_sec) for c in pending_chunks]
            language_code = db.get(Recording, recording_id).language_code

        logger.info(f"Transcribing {len(pending_data)} pending chunks (concurrency={settings.WORKER_CONCURRENCY})...")
        
        with ThreadPoolExecutor(max_workers=settings.WORKER_CONCURRENCY) as executor:
            futures = {
                executor.submit(
                    process_transcribe_chunk_task,
                    c_id,
                    recording_id,
                    c_idx,
                    c_start,
                    c_end,
                    norm_wav_path,
                    temp_dir,
                    language_code
                ): c_idx
                for (c_id, c_idx, c_start, c_end) in pending_data
            }
            for future in as_completed(futures):
                idx = futures[future]
                try:
                    future.result()
                except Exception as e:
                    logger.error(f"Uncaught thread exception in chunk {idx}: {e}")

        # Step 5: Stitch transcript and assess completion status
        with SessionLocal() as db:
            all_chunks = db.scalars(
                select(Chunk)
                .where(Chunk.recording_id == recording_id)
                .order_by(Chunk.idx)
            ).all()

            failed_chunks = [c for c in all_chunks if c.status == ChunkStatus.FAILED]
            done_chunks = [c for c in all_chunks if c.status == ChunkStatus.DONE]
            
            # Case A: ALL chunks failed
            if len(failed_chunks) == len(all_chunks) and len(all_chunks) > 0:
                first_err = failed_chunks[0].error or "ASR transcription failed"
                err_code = "ASR_UNAVAILABLE"
                if "403" in first_err or "credit" in first_err.lower() or "auth" in first_err.lower():
                    err_code = "ASR_AUTH_OR_CREDITS"
                elif "400" in first_err or "bad" in first_err.lower():
                    err_code = "ASR_BAD_REQUEST"

                db.execute(
                    update(Recording)
                    .where(Recording.id == recording_id)
                    .values(
                        status=RecordingStatus.FAILED,
                        transcript_status=TranscriptStatus.FAILED,
                        summary_status=SummaryStatus.FAILED,
                        stage=None,
                        error_code=err_code,
                        error_message=f"All audio segments failed to transcribe: {first_err}"
                    )
                )
                db.commit()
                mark_job_failed(db, job.id, f"All chunks failed: {first_err}")
                return

            # Build stitched transcript
            transcript_segments = []
            non_empty_count = 0
            for c in all_chunks:
                if c.status == ChunkStatus.DONE:
                    text_val = (c.text or "").strip()
                    if text_val:
                        non_empty_count += 1
                        transcript_segments.append(text_val)
                elif c.status == ChunkStatus.FAILED:
                    marker = f"[could not transcribe {format_timestamp(c.start_sec)}-{format_timestamp(c.end_sec)}]"
                    transcript_segments.append(marker)

            # Check if all chunks produced empty text (no speech detected)
            if done_chunks and non_empty_count == 0 and not failed_chunks:
                db.execute(
                    update(Recording)
                    .where(Recording.id == recording_id)
                    .values(
                        status=RecordingStatus.FAILED,
                        transcript_status=TranscriptStatus.FAILED,
                        summary_status=SummaryStatus.FAILED,
                        stage=None,
                        error_code="NO_SPEECH",
                        error_message="No intelligible speech detected in the audio recording."
                    )
                )
                db.commit()
                mark_job_failed(db, job.id, "No speech detected")
                return

            stitched_text = "\n\n".join(transcript_segments).strip()
            transcript_status = TranscriptStatus.PARTIAL if failed_chunks else TranscriptStatus.DONE

            # Step 6: LLM Summarization
            db.execute(
                update(Recording)
                .where(Recording.id == recording_id)
                .values(
                    transcript_text=stitched_text,
                    transcript_status=transcript_status,
                    stage=Stage.SUMMARIZING
                )
            )
            db.commit()

        # Step 7: Run LLM summarization
        logger.info(f"Generating LLM summary for recording {recording_id} (chars={len(stitched_text)})...")
        summary_result = None
        summary_err_msg = None
        
        try:
            summary_result = llm_service.summarize_transcript(
                transcript_text=stitched_text,
                language_code=language_code
            )
        except Exception as e:
            logger.warning(f"LLM Summarization failed for {recording_id}: {e}")
            summary_err_msg = str(e)

        # Step 8: Finalize recording status
        with SessionLocal() as db:
            rec = db.get(Recording, recording_id)
            if summary_result:
                rec.summary_json = summary_result
                rec.summary_status = SummaryStatus.DONE
                rec.title = summary_result.get("title") or os.path.splitext(rec.filename)[0]
            else:
                rec.summary_status = SummaryStatus.FAILED
                rec.title = os.path.splitext(rec.filename)[0]
                rec.error_message = f"Transcript ready, but summary failed: {summary_err_msg}" if not rec.error_message else rec.error_message

            # Status is COMPLETED because transcript exists (even if partial or summary failed)
            rec.status = RecordingStatus.COMPLETED
            rec.stage = None
            db.commit()
            mark_job_completed(db, job.id)

        logger.info(f"Recording {recording_id} processing finished successfully. Status: COMPLETED.")

    except AudioValidationError as e:
        logger.error(f"Audio validation failed for recording {recording_id}: [{e.code}] {e.message}")
        with SessionLocal() as db:
            db.execute(
                update(Recording)
                .where(Recording.id == recording_id)
                .values(
                    status=RecordingStatus.FAILED,
                    stage=None,
                    error_code=e.code,
                    error_message=e.message
                )
            )
            db.commit()
            mark_job_failed(db, job.id, f"[{e.code}] {e.message}")

    except Exception as e:
        logger.error(f"Unexpected exception processing recording {recording_id}: {e}\n{traceback.format_exc()}")
        with SessionLocal() as db:
            db.execute(
                update(Recording)
                .where(Recording.id == recording_id)
                .values(
                    status=RecordingStatus.FAILED,
                    stage=None,
                    error_code="UNEXPECTED",
                    error_message=f"Processing failed: {str(e)}"
                )
            )
            db.commit()
            mark_job_failed(db, job.id, str(e))

    finally:
        heartbeat.stop()
        if os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warning(f"Failed to remove temp dir {temp_dir}: {e}")


def handle_summarize_job(job: Job) -> None:
    """
    Handles summary retry jobs when only the LLM summary failed.
    """
    recording_id = job.recording_id
    heartbeat = HeartbeatThread(job.id)
    heartbeat.start()

    try:
        with SessionLocal() as db:
            recording = db.get(Recording, recording_id)
            if not recording or not recording.transcript_text:
                mark_job_failed(db, job.id, "No transcript found for summarization")
                return

            recording.status = RecordingStatus.PROCESSING
            recording.stage = Stage.SUMMARIZING
            recording.summary_status = SummaryStatus.PENDING
            db.commit()
            
            text = recording.transcript_text
            lang = recording.language_code

        logger.info(f"Retrying LLM summary for recording {recording_id}...")
        summary_result = llm_service.summarize_transcript(transcript_text=text, language_code=lang)

        with SessionLocal() as db:
            rec = db.get(Recording, recording_id)
            rec.summary_json = summary_result
            rec.summary_status = SummaryStatus.DONE
            if summary_result.get("title"):
                rec.title = summary_result.get("title")
            rec.status = RecordingStatus.COMPLETED
            rec.stage = None
            db.commit()
            mark_job_completed(db, job.id)

        logger.info(f"Summary retry completed for recording {recording_id}.")

    except Exception as e:
        logger.error(f"Summary retry failed for recording {recording_id}: {e}")
        with SessionLocal() as db:
            rec = db.get(Recording, recording_id)
            if rec:
                rec.summary_status = SummaryStatus.FAILED
                rec.status = RecordingStatus.COMPLETED
                rec.stage = None
                rec.error_message = f"Summary retry failed: {str(e)}"
                db.commit()
            mark_job_failed(db, job.id, str(e))
    finally:
        heartbeat.stop()


def run_worker_loop():
    """
    Main worker loop that continuously claims and executes jobs from the database queue.
    """
    logger.info("Worker started. Listening for background jobs...")
    while True:
        try:
            with SessionLocal() as db:
                job = claim_next_job(db)

            if job:
                logger.info(f"Executing job {job.id} (kind={job.kind}, recording={job.recording_id})")
                if job.kind == JobKind.PROCESS_RECORDING:
                    handle_process_recording_job(job)
                elif job.kind == JobKind.SUMMARIZE:
                    handle_summarize_job(job)
                else:
                    logger.warning(f"Unknown job kind: {job.kind}")
                    with SessionLocal() as db:
                        mark_job_failed(db, job.id, f"Unknown job kind: {job.kind}")
            else:
                # Sleep briefly when idle
                time.sleep(1.0)

        except KeyboardInterrupt:
            logger.info("Worker received interrupt. Shutting down gracefully...")
            break
        except Exception as e:
            logger.error(f"Error in worker polling loop: {e}\n{traceback.format_exc()}")
            time.sleep(2.0)


if __name__ == "__main__":
    run_worker_loop()
