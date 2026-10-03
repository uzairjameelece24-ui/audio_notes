import os
import time
import random
import logging
import httpx
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


class ASRError(Exception):
    def __init__(self, code: str, message: str, retryable: bool = False, status_code: Optional[int] = None):
        self.code = code
        self.message = message
        self.retryable = retryable
        self.status_code = status_code
        super().__init__(message)


class ASRAuthError(ASRError):
    def __init__(self, message: str = "Invalid Gnani API key or insufficient credits."):
        super().__init__(code="ASR_AUTH_OR_CREDITS", message=message, retryable=False, status_code=403)


class ASRBadRequestError(ASRError):
    def __init__(self, message: str = "Invalid audio format or parameters sent to Gnani ASR."):
        super().__init__(code="ASR_BAD_REQUEST", message=message, retryable=False, status_code=400)


class GnaniASRClient:
    def __init__(self):
        self.api_key = settings.GNANI_API_KEY
        self.api_url = settings.GNANI_API_URL
        self.mode = settings.ASR_MODE.lower()
        self.timeout = 60.0

    def transcribe_chunk(
        self,
        chunk_file_path: str,
        language_code: str = "en-IN",
        chunk_idx: int = 0
    ) -> str:
        """
        Transcribe a single audio chunk (<= 30s) with retries, exponential backoff, and error mapping.
        """
        # --- Handle Failure Injection ---
        fail_injections = settings.fail_inject_set
        if "asr_403" in fail_injections:
            logger.warning("[FAIL_INJECT] Simulating Gnani ASR 403 Forbidden")
            raise ASRAuthError("Simulated 403 Forbidden: Gnani API key invalid or credits exhausted.")
        if "asr_500" in fail_injections:
            logger.warning("[FAIL_INJECT] Simulating Gnani ASR 500 Internal Server Error")
            raise ASRError("ASR_UNAVAILABLE", "Simulated 500 Internal Server Error from Gnani STT", retryable=True, status_code=500)
        if "asr_timeout" in fail_injections:
            logger.warning("[FAIL_INJECT] Simulating Gnani ASR Timeout")
            raise ASRError("ASR_TIMEOUT", "Simulated connection timeout to Gnani ASR service", retryable=True)

        # --- Mock Mode ---
        if self.mode == "mock" or not self.api_key:
            return self._mock_transcribe(language_code, chunk_idx)

        # --- Real Gnani STT API Mode ---
        return self._real_transcribe_with_retry(chunk_file_path, language_code, chunk_idx)

    def _mock_transcribe(self, language_code: str, chunk_idx: int) -> str:
        # Simulate short processing latency
        time.sleep(0.35 + random.uniform(0.05, 0.15))
        
        mock_transcripts = {
            "en-IN": [
                "Welcome to the audio notes platform. Today we are discussing the end-to-end system design and core technical requirements.",
                "The system processes audio uploads asynchronously by chunking long audio into silence-aware segments under thirty seconds.",
                "Each audio segment is dispatched concurrently to Gnani's speech-to-text API, recording real-time progress in PostgreSQL.",
                "Once all segments are transcribed, the LLM generates structured insights, actionable items, and executive summaries.",
                "Robust error handling and recovery ensure that interrupted jobs can be safely retried without reprocessing finished work."
            ],
            "hi-IN": [
                "ऑडियो नोट्स प्लेटफॉर्म में आपका स्वागत है। आज हम पूरे सिस्टम डिज़ाइन पर चर्चा कर रहे हैं।",
                "यह सिस्टम लम्बी ऑडियो फाइलों को तीस सेकंड के छोटे हिस्सों में विभाजित करता है।",
                "प्रत्येक हिस्से को ज्ञानी एएसआर एपीआई द्वारा ट्रांसक्राइब किया जाता है।",
                "ट्रांसक्रिप्शन पूरा होने के बाद एलएलएम मॉडल मुख्य बिंदुओं का सारांश तैयार करता है।"
            ]
        }
        
        bank = mock_transcripts.get(language_code, mock_transcripts["en-IN"])
        text = bank[chunk_idx % len(bank)]
        return text

    def _real_transcribe_with_retry(
        self,
        chunk_file_path: str,
        language_code: str,
        chunk_idx: int,
        max_retries: int = 4
    ) -> str:
        if not os.path.exists(chunk_file_path):
            raise FileNotFoundError(f"Chunk file not found: {chunk_file_path}")

        headers = {
            "X-API-Key-ID": self.api_key
        }
        
        data = {
            "language_code": language_code,
            "format": "transcribe"
        }

        last_exception: Optional[Exception] = None

        for attempt in range(1, max_retries + 1):
            try:
                with open(chunk_file_path, "rb") as f:
                    files = {
                        "audio_file": (os.path.basename(chunk_file_path), f, "audio/wav")
                    }
                    with httpx.Client(timeout=self.timeout) as client:
                        response = client.post(
                            self.api_url,
                            headers=headers,
                            data=data,
                            files=files
                        )

                # HTTP 200 OK
                if response.status_code == 200:
                    res_json = response.json()
                    # Gnani STT response format: {"success": true, "transcript": "...", "request_id": "..."}
                    transcript = res_json.get("transcript", "")
                    return transcript.strip() if transcript else ""

                # HTTP 400 - Bad request (format, corrupt audio, unsupported language) -> NEVER RETRY
                if response.status_code == 400:
                    err_msg = response.text
                    logger.error(f"Gnani ASR 400 Bad Request: {err_msg}")
                    raise ASRBadRequestError(f"Gnani ASR rejected audio parameters or format: {err_msg}")

                # HTTP 403 - Auth / Credits -> NEVER RETRY
                if response.status_code == 403:
                    err_msg = response.text
                    logger.error(f"Gnani ASR 403 Forbidden: {err_msg}")
                    raise ASRAuthError(f"Gnani ASR authentication failed or credits exhausted: {err_msg}")

                # HTTP 429 - Rate limit -> RETRY with backoff
                if response.status_code == 429:
                    logger.warning(f"Gnani ASR 429 Rate Limit on chunk {chunk_idx}, attempt {attempt}/{max_retries}")
                    if attempt == max_retries:
                        raise ASRError("ASR_RATE_LIMIT", "Gnani ASR rate limit exceeded after retries.", retryable=True, status_code=429)

                # HTTP 500 / 502 / 503 / 504 -> RETRY with backoff
                if response.status_code >= 500:
                    logger.warning(f"Gnani ASR {response.status_code} Server Error on chunk {chunk_idx}, attempt {attempt}/{max_retries}")
                    if attempt == max_retries:
                        raise ASRError("ASR_UNAVAILABLE", f"Gnani ASR service unavailable ({response.status_code}).", retryable=True, status_code=response.status_code)

                # Other non-200 responses
                if attempt == max_retries:
                    raise ASRError("ASR_ERROR", f"Gnani ASR returned status {response.status_code}: {response.text}", retryable=False, status_code=response.status_code)

            except (ASRBadRequestError, ASRAuthError):
                raise
            except httpx.TimeoutException as e:
                logger.warning(f"Gnani ASR timeout on chunk {chunk_idx}, attempt {attempt}/{max_retries}: {e}")
                last_exception = ASRError("ASR_TIMEOUT", f"Connection to Gnani ASR timed out: {str(e)}", retryable=True)
                if attempt == max_retries:
                    raise last_exception
            except (httpx.ConnectError, httpx.NetworkError) as e:
                logger.warning(f"Gnani ASR network connection error on chunk {chunk_idx}, attempt {attempt}/{max_retries}: {e}")
                last_exception = ASRError("ASR_NETWORK_ERROR", f"Network error connecting to Gnani ASR: {str(e)}", retryable=True)
                if attempt == max_retries:
                    raise last_exception
            except ASRError:
                raise
            except Exception as e:
                logger.error(f"Unexpected error in Gnani ASR client: {e}")
                last_exception = ASRError("ASR_UNEXPECTED", f"Unexpected ASR error: {str(e)}", retryable=True)
                if attempt == max_retries:
                    raise last_exception

            # Exponential backoff with full jitter: (2^(attempt - 1)) + random jitter
            backoff_sec = (1.5 ** attempt) + random.uniform(0.1, 0.8)
            logger.info(f"Retrying Gnani ASR in {backoff_sec:.2f}s...")
            time.sleep(backoff_sec)

        if last_exception:
            raise last_exception
        raise ASRError("ASR_FAILED", "Gnani ASR transcription failed after maximum retries.")


# Global singleton instance
asr_client = GnaniASRClient()
