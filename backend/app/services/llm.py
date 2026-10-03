import json
import logging
import time
import random
from typing import Dict, Any, Optional
from app.config import settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class LLMService:
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model_name = settings.GROQ_MODEL
        self.mode = settings.LLM_MODE.lower()
        self._client = None  # lazy-init to avoid import errors if groq not installed

        if self.mode == "real" and self.api_key:
            try:
                from groq import Groq
                # Groq client is thread-safe; re-use across calls
                self._client = Groq(api_key=self.api_key)
                logger.info(f"Groq LLM client initialised (model={self.model_name})")
            except Exception as e:
                logger.warning(f"Could not initialise Groq client: {e}. Will fall back to mock.")

    # ── Public API ──────────────────────────────────────────────────────────────

    def summarize_transcript(
        self,
        transcript_text: str,
        language_code: str = "en-IN",
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        """
        Returns {title, tldr, key_points[], action_items[]}.
        Uses map-reduce automatically when transcript > 12 000 characters
        (Groq's context window is large, but keeping chunks small keeps latency low).
        """
        # Failure injection hook (used by verify_pipeline.py)
        if "bad_summary" in settings.fail_inject_set:
            logger.warning("[FAIL_INJECT] Simulating LLM summary failure")
            raise LLMError("LLM_SUMMARY_FAILED", "Simulated failure: LLM API returned an error.")

        if not transcript_text or not transcript_text.strip():
            raise LLMError("EMPTY_TRANSCRIPT", "Cannot summarize an empty transcript.")

        # Fall back to mock when no key / client available
        if self.mode == "mock" or not self.api_key or self._client is None:
            return self._mock_summarize(transcript_text, language_code)

        # Map-reduce for very long transcripts
        if len(transcript_text) > 12_000:
            return self._map_reduce_summarize(transcript_text, language_code, max_retries)

        return self._single_pass_summarize(transcript_text, language_code, max_retries)

    # ── Mock (no API key needed) ─────────────────────────────────────────────────

    def _mock_summarize(self, transcript_text: str, language_code: str) -> Dict[str, Any]:
        time.sleep(0.5 + random.uniform(0.1, 0.3))
        word_count = len(transcript_text.split())
        lang_note = f" (Translated & summarized from {language_code})" if language_code != "en-IN" else ""

        return {
            "title": f"Audio Summary: Systems Architecture & Processing Discussion{lang_note}",
            "tldr": (
                f"Comprehensive discussion covering asynchronous audio ingestion, silence-aware "
                f"chunking under 30 s for Gnani ASR, background job recovery, and LLM structured "
                f"summarization. Audio contains approximately {word_count} words."
            ),
            "key_points": [
                "Files of arbitrary duration are normalized and sliced at detected silences into <= 30 s chunks.",
                "Chunking tasks are queued in Postgres using SKIP LOCKED row-level locking for worker recovery.",
                "Individual chunk progress is updated in real-time, allowing retry of failed segments only.",
                "Summaries are generated via structured JSON schemas and map-reduce for long transcripts.",
            ],
            "action_items": [
                "Ensure S3 bucket CORS permissions are properly configured for direct browser PUT uploads.",
                "Review worker heartbeat intervals to tune stale-job reclamation thresholds.",
                "Monitor Gnani STT and Groq token usage across high-volume batch runs.",
            ],
        }

    # ── Real Groq call (single-pass) ────────────────────────────────────────────

    def _single_pass_summarize(
        self,
        transcript_text: str,
        language_code: str,
        max_retries: int,
    ) -> Dict[str, Any]:
        lang_note = (
            "The transcript is in English."
            if language_code == "en-IN"
            else (
                f"The original transcript is in language '{language_code}'. "
                "Write the summary in English and mention the source language explicitly."
            )
        )

        # Groq chat-completions API with JSON mode
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an expert audio analyst. "
                    "Respond ONLY with valid JSON — no markdown, no prose."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Analyze the following transcript and return a JSON object with EXACTLY this schema:\n"
                    '{"title": "concise title (max 8 words)", '
                    '"tldr": "2–3 sentence executive overview", '
                    '"key_points": ["point 1", "point 2", ...], '
                    '"action_items": ["action 1", "action 2", ...]}\n\n'
                    f"Language note: {lang_note}\n\n"
                    f"TRANSCRIPT:\n\"\"\"\n{transcript_text}\n\"\"\""
                ),
            },
        ]

        for attempt in range(1, max_retries + 1):
            try:
                response = self._client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    response_format={"type": "json_object"},  # Groq JSON mode
                    temperature=0.2,
                    max_tokens=1024,
                )
                raw = response.choices[0].message.content.strip()
                parsed = json.loads(raw)
                return {
                    "title": parsed.get("title", "Audio Summary"),
                    "tldr": parsed.get("tldr", ""),
                    "key_points": parsed.get("key_points", []),
                    "action_items": parsed.get("action_items", []),
                }

            except json.JSONDecodeError as e:
                logger.warning(f"Groq returned non-JSON on attempt {attempt}: {e}")
            except Exception as e:
                logger.warning(f"Groq call failed on attempt {attempt}/{max_retries}: {e}")
                if attempt == max_retries:
                    raise LLMError("LLM_SUMMARY_FAILED", f"Groq summarization failed: {e}")

            time.sleep(2.0 ** attempt)  # exponential backoff

        raise LLMError("LLM_SUMMARY_FAILED", "Groq summarization failed after retries.")

    # ── Map-reduce for long transcripts ─────────────────────────────────────────

    def _map_reduce_summarize(
        self,
        transcript_text: str,
        language_code: str,
        max_retries: int,
    ) -> Dict[str, Any]:
        """Split into 10 000-char segments, summarize each (map), then combine (reduce)."""
        logger.info(f"Using map-reduce summarization (transcript length={len(transcript_text)})")

        chunk_size = 10_000
        segments = [
            transcript_text[i : i + chunk_size]
            for i in range(0, len(transcript_text), chunk_size)
        ]

        partial_summaries = []
        for idx, seg in enumerate(segments):
            try:
                resp = self._client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {
                            "role": "user",
                            "content": (
                                f"Summarize Part {idx + 1} of {len(segments)} of an audio transcript "
                                "in 1–2 detailed paragraphs:\n\n"
                                f"\"\"\"\n{seg}\n\"\"\""
                            ),
                        }
                    ],
                    temperature=0.2,
                    max_tokens=512,
                )
                partial_summaries.append(resp.choices[0].message.content.strip())
            except Exception as e:
                logger.error(f"Map step failed for part {idx + 1}: {e}")
                partial_summaries.append(f"[Part {idx + 1} summary failed: {e}]")

        combined = "\n\n".join(partial_summaries)
        # Reduce: treat combined intermediate summaries as the transcript for final structuring
        return self._single_pass_summarize(combined, language_code, max_retries)


# Global singleton — shared across worker threads
llm_service = LLMService()
