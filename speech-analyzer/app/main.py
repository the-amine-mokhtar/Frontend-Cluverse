"""FastAPI entry point for Speech Analyzer microservice."""

from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.models.schemas import (
    AllMetrics,
    AnalyzeRequest,
    HealthResponse,
    SpeechReport,
    QuizRequest,
    QuizResponse,
    CVAnalysisRequest,
    CVAnalysisResponse,
    LearningPathRequest,
    LearningPathResponse,
)
from app.services.quiz_service import quiz_service
from app.services.cv_service import cv_service
from app.pipeline.acoustic import energy_level, pause_analysis, pitch_variation, speech_rate
from app.pipeline.filler_detector import detect_fillers
from app.pipeline.llm_feedback import generate_feedback
from app.pipeline.scorer import calculate_score, warmup_scorer
from app.pipeline.transcriber import decode_audio_bytes, get_transcriber
from app.websocket.speech_handler import router as websocket_router
from app.websocket.speech_handler import session_manager

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Speech Analyzer Service", version="1.0.0")
app.include_router(websocket_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    """Warm up heavy components to reduce first-request latency."""

    logger.info("Warming up application components")
    get_transcriber().warmup()
    warmup_scorer()
    logger.info("Startup warmup completed")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Return service and model readiness state."""

    transcriber = get_transcriber()
    return HealthResponse(
        status="ok" if transcriber.is_model_loaded() else "degraded",
        whisper_loaded=transcriber.is_model_loaded(),
        model_version=settings.whisper_model,
    )


@app.post("/health", response_model=HealthResponse)
async def health_post() -> HealthResponse:
    """Allow POST health checks for integration compatibility."""

    return await health()


@app.post("/analyze", response_model=SpeechReport)
async def analyze_audio(request: AnalyzeRequest) -> SpeechReport:
    """Analyze a full audio payload in one request and return full report."""

    try:
        audio_bytes = base64.b64decode(request.audio_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid audio_base64 payload: {exc}") from exc

    transcript = get_transcriber().transcribe_chunk(audio_bytes)
    audio_np = decode_audio_bytes(audio_bytes)
    duration = float(len(audio_np) / max(settings.audio_sample_rate, 1))

    metrics = {
        "duration_seconds": duration,
        "speech_rate": speech_rate(len(transcript.words), duration),
        "whisper_confidence": transcript.confidence,
        "pitch": pitch_variation(audio_np),
        "energy_level": energy_level(audio_np),
        "pauses": pause_analysis(transcript.words, duration),
        "fillers": detect_fillers(transcript.text, duration_seconds=duration),
        "transcript_length": len(transcript.words),
    }

    all_metrics = AllMetrics(**metrics)
    score = calculate_score(all_metrics)
    feedback = await generate_feedback(all_metrics, transcript.text)

    return SpeechReport(
        session_id=request.session_id,
        duration=duration,
        transcript_full=transcript.text,
        metrics=all_metrics,
        score=score,
        feedback=feedback,
        timestamp=datetime.now(timezone.utc),
    )


@app.post("/report/{session_id}", response_model=SpeechReport)
async def close_session_report(session_id: str) -> SpeechReport:
    """Close an active WebSocket session and return its final report."""

    report = await session_manager.finalize_session(session_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"No active session found for '{session_id}'")
    return report


@app.post("/quiz/generate", response_model=QuizResponse)
async def generate_skill_quiz(request: QuizRequest) -> QuizResponse:
    """Generate a technical quiz for a specific skill and level."""

    try:
        quiz = await quiz_service.generate_quiz(request.skill_name, request.level)
        return QuizResponse(**quiz)
    except Exception as e:
        logger.error(f"Quiz generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cv/analyze", response_model=CVAnalysisResponse)
async def analyze_cv(request: CVAnalysisRequest) -> CVAnalysisResponse:
    """Analyze a CV text and return suggested competencies and description."""

    try:
        return await cv_service.analyze_cv_text(request.text)
    except Exception as e:
        logger.error(f"CV analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/learning-path/generate", response_model=LearningPathResponse)
async def generate_learning_path(request: LearningPathRequest) -> LearningPathResponse:
    """Generate a personalized learning path for a skill."""

    try:
        return await cv_service.generate_learning_path(request.skill_name, request.target_level)
    except Exception as e:
        logger.error(f"Learning path generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
