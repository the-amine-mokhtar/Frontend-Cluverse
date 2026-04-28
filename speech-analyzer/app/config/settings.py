"""Runtime configuration for the Speech Analyzer service."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    whisper_model: str = Field(default="base", alias="WHISPER_MODEL")
    transcription_language: str = Field(default="fr", alias="TRANSCRIPTION_LANGUAGE")
    whisper_beam_size: int = Field(default=5, alias="WHISPER_BEAM_SIZE")
    whisper_best_of: int = Field(default=5, alias="WHISPER_BEST_OF")
    whisper_patience: float = Field(default=1.0, alias="WHISPER_PATIENCE")
    whisper_no_speech_threshold: float = Field(default=0.45, alias="WHISPER_NO_SPEECH_THRESHOLD")
    whisper_logprob_threshold: float = Field(default=-1.0, alias="WHISPER_LOGPROB_THRESHOLD")
    whisper_compression_ratio_threshold: float = Field(default=2.2, alias="WHISPER_COMPRESSION_RATIO_THRESHOLD")
    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    ollama_base_url: str = Field(default="http://localhost:11434/v1", alias="OLLAMA_BASE_URL")
    llm_model: str = Field(default="gpt-4o", alias="LLM_MODEL")
    feedback_interval_seconds: int = Field(default=30, alias="FEEDBACK_INTERVAL_SECONDS")
    audio_sample_rate: int = Field(default=16000, alias="AUDIO_SAMPLE_RATE")
    speech_rate_max_wpm: float = Field(default=240.0, alias="SPEECH_RATE_MAX_WPM")
    speech_rate_min_duration_seconds: float = Field(default=0.8, alias="SPEECH_RATE_MIN_DURATION_SECONDS")
    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8001, alias="PORT")
    spring_backend_url: str = Field(default="http://localhost:8080", alias="SPRING_BACKEND_URL")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached settings instance for the whole process."""

    return Settings()
