"""Pydantic schemas used across REST, WebSocket, and ML pipeline layers."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class AudioChunk(BaseModel):
    """Incoming audio chunk payload."""

    session_id: str
    audio_base64: str
    chunk_index: int = Field(default=0, ge=0)


class AnalyzeRequest(BaseModel):
    """Request model for full-audio analysis."""

    audio_base64: str
    session_id: str


class TranscriptWord(BaseModel):
    """Word-level transcript item with optional confidence and timestamps."""

    word: str
    start: float = Field(ge=0.0)
    end: float = Field(ge=0.0)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class TranscriptResult(BaseModel):
    """Chunk transcription output."""

    text: str
    language: str
    confidence: float = Field(ge=0.0, le=1.0)
    words: list[TranscriptWord] = Field(default_factory=list)


class PitchMetrics(BaseModel):
    """Pitch characteristics extracted from waveform."""

    mean_pitch: float = Field(ge=0.0)
    std_pitch: float = Field(ge=0.0)
    variation_score: float = Field(ge=0.0, le=100.0)


class PauseMetrics(BaseModel):
    """Pause timing indicators from transcript word timings."""

    pause_count: int = Field(ge=0)
    avg_pause_duration: float = Field(ge=0.0)
    long_pauses: int = Field(ge=0)


class FillerResult(BaseModel):
    """Detected filler words and their speaking-rate normalized impact."""

    fillers_found: dict[str, int] = Field(default_factory=dict)
    total_count: int = Field(ge=0)
    rate_per_minute: float = Field(ge=0.0)


class AllMetrics(BaseModel):
    """Full metrics used for scoring and feedback generation."""

    duration_seconds: float = Field(ge=0.0)
    speech_rate: float = Field(ge=0.0)
    whisper_confidence: float = Field(ge=0.0, le=1.0)
    pitch: PitchMetrics
    energy_level: float = Field(ge=0.0, le=100.0)
    pauses: PauseMetrics
    fillers: FillerResult
    transcript_length: int = Field(ge=0)


class ScoreBreakdown(BaseModel):
    """Weighted sub-scores that compose the global score."""

    clarity_score: float = Field(ge=0.0, le=100.0)
    pace_score: float = Field(ge=0.0, le=100.0)
    filler_score: float = Field(ge=0.0, le=100.0)
    pitch_score: float = Field(ge=0.0, le=100.0)
    energy_score: float = Field(ge=0.0, le=100.0)


class ScoreResult(BaseModel):
    """Global scoring output used by UI and persistence layer."""

    global_score: float = Field(ge=0.0, le=100.0)
    breakdown: ScoreBreakdown
    level: Literal["BEGINNER", "INTERMEDIATE", "ADVANCED"]


class SpeechReport(BaseModel):
    """Final report for one speech session."""

    session_id: str
    duration: float = Field(ge=0.0)
    transcript_full: str
    metrics: AllMetrics
    score: ScoreResult
    feedback: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RealtimeMetricsMessage(BaseModel):
    """WebSocket message sent after each processed chunk."""

    type: Literal["realtime_metrics"] = "realtime_metrics"
    session_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    transcript_partial: str
    metrics: AllMetrics
    score: ScoreResult


class AIFeedbackMessage(BaseModel):
    """WebSocket message carrying asynchronous LLM coaching feedback."""

    type: Literal["ai_feedback"] = "ai_feedback"
    session_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    feedback: str


class FinalReportMessage(BaseModel):
    """WebSocket message emitted when a session ends."""

    type: Literal["final_report"] = "final_report"
    session_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    report: SpeechReport


class HealthResponse(BaseModel):
    """Health endpoint response contract."""

    status: Literal["ok", "degraded"]
    whisper_loaded: bool
    model_version: str


class GenericWSMessage(BaseModel):
    """Generic incoming message model for WebSocket text frames."""

    model_config = ConfigDict(extra="allow")

    type: str

    def get_payload(self) -> dict[str, Any]:
        """Return full payload including additional dynamic keys."""

        return self.model_dump()


class QuizRequest(BaseModel):
    """Request for generating a technical quiz."""

    skill_name: str
    level: int = Field(default=0, ge=0, le=5)


class QuizQuestion(BaseModel):
    """A single technical quiz question."""

    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_answer: int = Field(ge=0, le=3)
    explanation: str


class QuizResponse(BaseModel):
    """Full quiz data returned from LLM."""

    skill: str
    level: str
    questions: list[QuizQuestion]


class CVAnalysisRequest(BaseModel):
    """Request for CV analysis."""
    text: str


class CompetencyImpact(BaseModel):
    """Suggested competency from CV."""
    name: str
    level: int = Field(ge=0, le=5)
    category: Literal["SOFT", "HARD", "TECHNICAL"]
    reason: str


class CVAnalysisResponse(BaseModel):
    """Full CV analysis results."""
    suggested_competencies: list[CompetencyImpact]
    overall_description: str = Field(default="")


class LearningResource(BaseModel):
    title: str = Field(default="Resource")
    url: str = Field(default="#")
    youtube_id: str | None = Field(default=None)
    search_query: str | None = Field(default="")
    type: str = Field(default="VIDEO")  # VIDEO, ARTICLE, COURSE
    platform: str = Field(default="YouTube")
    description: str = Field(default="")

class LearningPathResponse(BaseModel):
    skill_name: str = Field(default="")
    target_level: int = Field(default=5)
    resources: list[LearningResource] = Field(default_factory=list)
    estimated_time: str = Field(default="N/A")


class LearningPathRequest(BaseModel):
    skill_name: str
    target_level: int
