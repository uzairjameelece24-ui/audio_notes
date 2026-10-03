import pytest
import os
import tempfile
from unittest.mock import patch, MagicMock
from app.services.asr import GnaniASRClient, ASRAuthError, ASRBadRequestError, ASRError
from app.config import settings


@pytest.fixture
def temp_wav():
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(b"RIFFdummywavdata")
        f.flush()
        yield f.name
    if os.path.exists(f.name):
        os.remove(f.name)


def test_mock_transcription(temp_wav):
    """Mock mode should return sample text quickly without external HTTP calls."""
    client = GnaniASRClient()
    client.mode = "mock"
    text = client.transcribe_chunk(temp_wav, language_code="en-IN", chunk_idx=0)
    assert isinstance(text, str)
    assert len(text) > 0


def test_400_bad_request_never_retries(temp_wav):
    """Gnani 400 Bad Request should immediately raise ASRBadRequestError without retry."""
    client = GnaniASRClient()
    client.mode = "real"
    client.api_key = "test_key"

    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.text = "Invalid language_code specified"

    with patch("httpx.Client.post", return_value=mock_response) as mock_post:
        with pytest.raises(ASRBadRequestError) as exc_info:
            client.transcribe_chunk(temp_wav, language_code="en-IN", chunk_idx=0)

        assert mock_post.call_count == 1  # Exactly 1 attempt, NO retry
        assert "rejected audio parameters" in str(exc_info.value)


def test_403_auth_or_credits_never_retries(temp_wav):
    """Gnani 403 Forbidden should immediately raise ASRAuthError without retry."""
    client = GnaniASRClient()
    client.mode = "real"
    client.api_key = "test_key"

    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.text = "Account credits exhausted"

    with patch("httpx.Client.post", return_value=mock_response) as mock_post:
        with pytest.raises(ASRAuthError) as exc_info:
            client.transcribe_chunk(temp_wav, language_code="en-IN", chunk_idx=0)

        assert mock_post.call_count == 1  # Exactly 1 attempt, NO retry
        assert exc_info.value.code == "ASR_AUTH_OR_CREDITS"


def test_500_server_error_retries_and_backs_off(temp_wav):
    """Gnani 500 error should retry up to max_retries and raise ASRError."""
    client = GnaniASRClient()
    client.mode = "real"
    client.api_key = "test_key"

    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"

    with patch("httpx.Client.post", return_value=mock_response) as mock_post, \
         patch("time.sleep", return_value=None):
        with pytest.raises(ASRError) as exc_info:
            client.transcribe_chunk(temp_wav, language_code="en-IN", chunk_idx=0)

        assert mock_post.call_count == 4  # Retried 4 times
        assert exc_info.value.code == "ASR_UNAVAILABLE"


def test_429_rate_limit_recovers_on_retry(temp_wav):
    """Gnani 429 rate limit should retry and return transcript if a later attempt succeeds."""
    client = GnaniASRClient()
    client.mode = "real"
    client.api_key = "test_key"

    rate_limit_resp = MagicMock()
    rate_limit_resp.status_code = 429
    rate_limit_resp.text = "Too Many Requests"

    success_resp = MagicMock()
    success_resp.status_code = 200
    success_resp.json.return_value = {"success": True, "transcript": "Recovered text"}

    with patch("httpx.Client.post", side_effect=[rate_limit_resp, success_resp]) as mock_post, \
         patch("time.sleep", return_value=None):
        result = client.transcribe_chunk(temp_wav, language_code="en-IN", chunk_idx=0)
        assert mock_post.call_count == 2
        assert result == "Recovered text"
