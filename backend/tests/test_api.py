import pytest
import uuid
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Recording, Chunk, RecordingStatus, Stage, ChunkStatus

client = TestClient(app)
TEST_CLIENT_ID = "test-uuid-client-12345"


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"


def test_missing_client_id_header():
    response = client.get("/api/recordings")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "MISSING_CLIENT_ID"


def test_upload_init_validation():
    # Unsupported file extension
    bad_ext_payload = {
        "filename": "document.pdf",
        "content_type": "application/pdf",
        "size_bytes": 1024,
        "language_code": "en-IN"
    }
    res = client.post(
        "/api/uploads/init",
        json=bad_ext_payload,
        headers={"X-Client-Id": TEST_CLIENT_ID}
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_FILE_TYPE"

    # Unsupported language code
    bad_lang_payload = {
        "filename": "speech.wav",
        "content_type": "audio/wav",
        "size_bytes": 1024,
        "language_code": "fr-FR"
    }
    res = client.post(
        "/api/uploads/init",
        json=bad_lang_payload,
        headers={"X-Client-Id": TEST_CLIENT_ID}
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "UNSUPPORTED_LANGUAGE"

    # File exceeding size limit
    giant_payload = {
        "filename": "speech.wav",
        "content_type": "audio/wav",
        "size_bytes": 600 * 1024 * 1024,  # 600 MB
        "language_code": "en-IN"
    }
    res = client.post(
        "/api/uploads/init",
        json=giant_payload,
        headers={"X-Client-Id": TEST_CLIENT_ID}
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_upload_lifecycle_init_and_complete():
    init_payload = {
        "filename": "interview_meeting.mp3",
        "content_type": "audio/mpeg",
        "size_bytes": 5 * 1024 * 1024,
        "language_code": "en-IN"
    }

    res = client.post(
        "/api/uploads/init",
        json=init_payload,
        headers={"X-Client-Id": TEST_CLIENT_ID}
    )
    assert res.status_code == 200
    data = res.json()
    assert "recording_id" in data
    assert "upload_url" in data
    rec_id = data["recording_id"]

    # Test Complete upload with simulated missing S3 object
    with patch("app.services.storage.storage_service.head_object", return_value=None):
        comp_fail = client.post(
            f"/api/uploads/{rec_id}/complete",
            headers={"X-Client-Id": TEST_CLIENT_ID}
        )
        assert comp_fail.status_code == 409
        assert comp_fail.json()["error"]["code"] == "UPLOAD_MISSING"

    # Test Complete upload with S3 object present
    with patch("app.services.storage.storage_service.head_object", return_value={"ContentLength": 5000000}):
        comp_success = client.post(
            f"/api/uploads/{rec_id}/complete",
            headers={"X-Client-Id": TEST_CLIENT_ID}
        )
        assert comp_success.status_code == 202
        assert comp_success.json()["status"] == "QUEUED"

    # List recordings for this client
    list_res = client.get("/api/recordings", headers={"X-Client-Id": TEST_CLIENT_ID})
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(item["id"] == rec_id for item in items)

    # Different client cannot see this recording
    other_list = client.get("/api/recordings", headers={"X-Client-Id": "different-client-999"})
    assert other_list.status_code == 200
    assert not any(item["id"] == rec_id for item in other_list.json())

    # Get recording detail
    detail_res = client.get(f"/api/recordings/{rec_id}", headers={"X-Client-Id": TEST_CLIENT_ID})
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == rec_id
    assert detail["filename"] == "interview_meeting.mp3"
    assert "progress" in detail
    assert "chunks_total" in detail["progress"]

    # Delete recording
    with patch("app.services.storage.storage_service.delete_object", return_value=True):
        del_res = client.delete(f"/api/recordings/{rec_id}", headers={"X-Client-Id": TEST_CLIENT_ID})
        assert del_res.status_code == 200
        assert del_res.json()["message"] == "Recording deleted successfully."

    # Verify deleted
    get_after_del = client.get(f"/api/recordings/{rec_id}", headers={"X-Client-Id": TEST_CLIENT_ID})
    assert get_after_del.status_code == 404
