#!/usr/bin/env python3
"""
Verification script for Audio Notes end-to-end processing & failure injection.
"""
import os
import sys
import time
import uuid
import httpx
import threading

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.worker import handle_process_recording_job, handle_summarize_job
from app.services.queue import claim_next_job
from app.database import SessionLocal
from app.models import Job, JobKind

API_BASE = "http://127.0.0.1:8000/api"
CLIENT_ID = str(uuid.uuid4())


def run_one_job():
    """Helper to claim and process 1 background job synchronously."""
    with SessionLocal() as db:
        job = claim_next_job(db)
    if job:
        print(f"  [Worker Mock] Executing job {job.id} (kind={job.kind})")
        if job.kind == JobKind.PROCESS_RECORDING:
            handle_process_recording_job(job)
        elif job.kind == JobKind.SUMMARIZE:
            handle_summarize_job(job)
        return True
    return False


def test_happy_path_e2e():
    print("\n--- 1. Testing End-to-End Processing (Happy Path) ---")
    settings.FAIL_INJECT = ""
    settings.ASR_MODE = "mock"
    settings.LLM_MODE = "mock"

    audio_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../sample_audio/test_speech_3min.wav"))
    assert os.path.exists(audio_file), f"Test audio not found at {audio_file}"
    file_size = os.path.getsize(audio_file)

    headers = {"X-Client-Id": CLIENT_ID}
    with httpx.Client(base_url=API_BASE) as client:
        # Step 1: Init upload
        init_res = client.post("/uploads/init", headers=headers, json={
            "filename": "test_speech_3min.wav",
            "content_type": "audio/wav",
            "size_bytes": file_size,
            "language_code": "en-IN"
        })
        assert init_res.status_code == 200, f"Init failed: {init_res.text}"
        data = init_res.json()
        rec_id = data["recording_id"]
        upload_url = data["upload_url"]
        print(f"  [1] Init successful: recording_id={rec_id}")

        # Step 2: PUT file to presigned URL
        with open(audio_file, "rb") as f:
            put_res = httpx.put(upload_url, content=f.read(), headers={"Content-Type": "audio/wav"})
        assert put_res.status_code in [200, 204], f"S3 PUT failed: {put_res.status_code} {put_res.text}"
        print(f"  [2] Audio uploaded to S3 presigned URL")

        # Step 3: Complete upload
        comp_res = client.post(f"/uploads/{rec_id}/complete", headers=headers)
        assert comp_res.status_code == 202, f"Complete failed: {comp_res.text}"
        print(f"  [3] Upload complete signal acknowledged, job queued")

        # Step 4: Run worker job
        worked = run_one_job()
        assert worked, "Worker did not find queued job"

        # Step 5: Poll detail
        detail_res = client.get(f"/recordings/{rec_id}", headers=headers)
        assert detail_res.status_code == 200
        detail = detail_res.json()
        print(f"  [4] Recording Status: {detail['status']}, Transcript Status: {detail['transcript_status']}, Summary Status: {detail['summary_status']}")
        print(f"      Duration: {detail['duration_sec']:.1f}s, Chunks Total: {detail['progress']['chunks_total']}, Chunks Done: {detail['progress']['chunks_done']}")
        print(f"      Summary Title: {detail['title']}")
        assert detail["status"] == "COMPLETED"
        assert detail["transcript_status"] == "DONE"
        assert detail["summary_status"] == "DONE"
        assert len(detail["segments"]) > 1
        assert detail["summary_json"] is not None
        print("  [✓] Happy Path PASSED!")


def test_failure_injection_bad_summary_and_retry():
    print("\n--- 2. Testing Failure Injection: bad_summary & Summary Retry ---")
    settings.FAIL_INJECT = "bad_summary"
    settings.ASR_MODE = "mock"
    settings.LLM_MODE = "mock"

    audio_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../sample_audio/test_speech_3min.wav"))
    file_size = os.path.getsize(audio_file)
    headers = {"X-Client-Id": CLIENT_ID}

    with httpx.Client(base_url=API_BASE) as client:
        init_res = client.post("/uploads/init", headers=headers, json={
            "filename": "summary_fail_test.wav",
            "content_type": "audio/wav",
            "size_bytes": file_size,
            "language_code": "en-IN"
        })
        rec_id = init_res.json()["recording_id"]
        upload_url = init_res.json()["upload_url"]

        with open(audio_file, "rb") as f:
            httpx.put(upload_url, content=f.read(), headers={"Content-Type": "audio/wav"})

        client.post(f"/uploads/{rec_id}/complete", headers=headers)
        run_one_job()

        detail_res = client.get(f"/recordings/{rec_id}", headers=headers)
        detail = detail_res.json()
        print(f"  [1] Status: {detail['status']}, Transcript Status: {detail['transcript_status']}, Summary Status: {detail['summary_status']}")
        assert detail["status"] == "COMPLETED"
        assert detail["transcript_status"] == "DONE"
        assert detail["summary_status"] == "FAILED"
        assert detail["transcript_text"] is not None
        print("  [2] Verified: Transcript is visible even when summary failed.")

        # Test Retry summary
        print("  [3] Retrying summary after clearing FAIL_INJECT...")
        settings.FAIL_INJECT = ""
        retry_res = client.post(f"/recordings/{rec_id}/retry", headers=headers)
        assert retry_res.status_code == 200
        run_one_job()

        detail_retry = client.get(f"/recordings/{rec_id}", headers=headers).json()
        print(f"  [4] Post-Retry Summary Status: {detail_retry['summary_status']}")
        assert detail_retry["summary_status"] == "DONE"
        print("  [✓] Summary Failure & Granular Retry PASSED!")


def test_failure_injection_asr_403():
    print("\n--- 3. Testing Failure Injection: asr_403 (Authentication/Credits Exhausted) ---")
    settings.FAIL_INJECT = "asr_403"
    audio_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../sample_audio/test_speech_3min.wav"))
    file_size = os.path.getsize(audio_file)
    headers = {"X-Client-Id": CLIENT_ID}

    with httpx.Client(base_url=API_BASE) as client:
        init_res = client.post("/uploads/init", headers=headers, json={
            "filename": "auth_fail_test.wav",
            "content_type": "audio/wav",
            "size_bytes": file_size,
            "language_code": "en-IN"
        })
        rec_id = init_res.json()["recording_id"]
        upload_url = init_res.json()["upload_url"]

        with open(audio_file, "rb") as f:
            httpx.put(upload_url, content=f.read(), headers={"Content-Type": "audio/wav"})

        client.post(f"/uploads/{rec_id}/complete", headers=headers)
        run_one_job()

        detail = client.get(f"/recordings/{rec_id}", headers=headers).json()
        print(f"  [1] Recording Status: {detail['status']}, Error Code: {detail['error_code']}")
        print(f"      Error Message: {detail['error_message']}")
        assert detail["status"] == "FAILED"
        assert detail["error_code"] == "ASR_AUTH_OR_CREDITS"
        print("  [✓] ASR 403 Failure Injection PASSED!")


def test_failure_injection_corrupt_audio():
    print("\n--- 4. Testing Failure Injection: corrupt_audio ---")
    settings.FAIL_INJECT = "corrupt_audio"
    audio_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../sample_audio/test_corrupt.wav"))
    file_size = os.path.getsize(audio_file)
    headers = {"X-Client-Id": CLIENT_ID}

    with httpx.Client(base_url=API_BASE) as client:
        init_res = client.post("/uploads/init", headers=headers, json={
            "filename": "test_corrupt.wav",
            "content_type": "audio/wav",
            "size_bytes": file_size,
            "language_code": "en-IN"
        })
        rec_id = init_res.json()["recording_id"]
        upload_url = init_res.json()["upload_url"]

        with open(audio_file, "rb") as f:
            httpx.put(upload_url, content=f.read(), headers={"Content-Type": "audio/wav"})

        client.post(f"/uploads/{rec_id}/complete", headers=headers)
        run_one_job()

        detail = client.get(f"/recordings/{rec_id}", headers=headers).json()
        print(f"  [1] Recording Status: {detail['status']}, Error Code: {detail['error_code']}")
        print(f"      Error Message: {detail['error_message']}")
        assert detail["status"] == "FAILED"
        assert detail["error_code"] == "CORRUPT_AUDIO"
        print("  [✓] Corrupt Audio Failure Injection PASSED!")


if __name__ == "__main__":
    test_happy_path_e2e()
    test_failure_injection_bad_summary_and_retry()
    test_failure_injection_asr_403()
    test_failure_injection_corrupt_audio()
    print("\n=======================================================")
    print("ALL BACKEND PIPELINE & FAILURE INJECTION TESTS PASSED!")
    print("=======================================================\n")
