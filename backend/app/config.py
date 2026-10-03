import json
from typing import List, Optional, Set
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration loaded from environment variables with sensible defaults.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgrespassword@localhost:5432/audio_notes"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+psycopg://"):
                return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    # Storage (S3-compatible: MinIO / S3Mock / Cloudflare R2 / Supabase Storage)
    S3_ENDPOINT_URL: Optional[str] = "http://localhost:9090"
    S3_PUBLIC_ENDPOINT_URL: Optional[str] = None  # If browser needs different host (e.g. localhost)
    S3_BUCKET_NAME: str = "audio-notes"
    AWS_ACCESS_KEY_ID: str = "test"
    AWS_SECRET_ACCESS_KEY: str = "test"
    AWS_REGION: str = "us-east-1"
    PRESIGNED_URL_EXPIRES_IN: int = 3600  # 1 hour

    # Gnani STT API
    GNANI_API_KEY: str = ""
    GNANI_API_URL: str = "https://api.vachana.ai/stt/v3"
    ASR_MODE: str = "mock"  # "mock" or "real"

    # LLM (Groq via groq SDK)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    LLM_MODE: str = "mock"  # "mock" or "real"

    # Testing & Failure Injection
    # e.g. "asr_500", "asr_timeout", "asr_403", "bad_summary", "corrupt_audio"
    FAIL_INJECT: str = ""

    # Limits & Tuning
    MAX_UPLOAD_MB: int = 500
    MAX_DURATION_MIN: int = 120
    WORKER_CONCURRENCY: int = 3
    CHUNK_TARGET_SEC: float = 24.0
    CHUNK_MIN_SEC: float = 18.0
    CHUNK_MAX_SEC: float = 28.0

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def fail_inject_set(self) -> Set[str]:
        return {item.strip() for item in self.FAIL_INJECT.split(",") if item.strip()}

    ALLOWED_EXTENSIONS: Set[str] = {
        ".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a"
    }

    ALLOWED_CONTENT_TYPES: Set[str] = {
        "audio/wav", "audio/x-wav", "audio/wave",
        "audio/mpeg", "audio/mp3",
        "audio/ogg", "application/ogg",
        "audio/flac", "audio/x-flac",
        "audio/aac", "audio/x-aac",
        "audio/m4a", "audio/x-m4a", "audio/mp4"
    }

    SUPPORTED_LANGUAGES: List[str] = [
        "en-IN", "hi-IN", "bn-IN", "gu-IN", "kn-IN", 
        "ml-IN", "mr-IN", "pa-IN", "ta-IN", "te-IN"
    ]


settings = Settings()
