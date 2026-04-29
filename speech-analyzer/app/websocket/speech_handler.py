"""Real-time speech WebSocket handler and in-memory session management."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from numpy import array

from app.config.settings import get_settings
from app.models.schemas import (
    AIFeedbackMessage,
    AllMetrics,
    FinalReportMessage,
    GenericWSMessage,
    RealtimeMetricsMessage,
    ScoreResult,
    SpeechReport,
    TranscriptWord,
)
from app.pipeline.acoustic import energy_level, pause_analysis, pitch_variation, speech_rate
from app.pipeline.filler_detector import detect_fillers
from app.pipeline.llm_feedback import generate_feedback
from app.pipeline.scorer import calculate_score
from app.pipeline.transcriber import decode_audio_bytes, transcribe_chunk

logger = logging.getLogger(__name__)
router = APIRouter()


@dataclass
class SpeechSession:
    """In-memory aggregate state for one speech session."""

    session_id: str
    session_start: float = field(default_factory=time.monotonic)
    all_words: list[TranscriptWord] = field(default_factory=list)
    all_metrics_history: list[AllMetrics] = field(default_factory=list)
    filler_counts: Counter[str] = field(default_factory=Counter)
    transcript_parts: list[str] = field(default_factory=list)
    topic_hint: str = field(default="")
    last_feedback_at: float = field(default=0.0)
    last_feedback_text: str = field(default="")


class SpeechSessionManager:
    """Concurrency-safe manager for speech sessions and reporting."""

    def __init__(self) -> None:
        self._sessions: dict[str, SpeechSession] = {}
        self._finalized_reports: dict[str, SpeechReport] = {}
        self._lock = asyncio.Lock()

    async def get_or_create(self, session_id: str) -> SpeechSession:
        """Get existing session or create a new one."""

        async with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                session = SpeechSession(session_id=session_id)
                self._sessions[session_id] = session
                logger.info("Session created", extra={"session_id": session_id})
            return session

    async def process_audio_chunk(self, session_id: str, audio_bytes: bytes) -> RealtimeMetricsMessage:
        """Run complete chunk pipeline and return a realtime metrics message."""

        session = await self.get_or_create(session_id)
        transcription_prompt = f"Sujet: {session.topic_hint}" if session.topic_hint else None

        transcript = transcribe_chunk(audio_bytes, prompt=transcription_prompt)
        audio_np = decode_audio_bytes(audio_bytes)
        duration = float(len(audio_np) / max(get_settings().audio_sample_rate, 1))

        current_metrics = AllMetrics(
            duration_seconds=duration,
            speech_rate=speech_rate(len(transcript.words), duration),
            whisper_confidence=transcript.confidence,
            pitch=pitch_variation(audio_np),
            energy_level=energy_level(audio_np),
            pauses=pause_analysis(transcript.words, duration),
            fillers=detect_fillers(transcript.text, duration_seconds=duration),
            transcript_length=len(transcript.words),
        )
        session.all_words.extend(transcript.words)
        session.all_metrics_history.append(current_metrics)
        session.transcript_parts.append(transcript.text)
        session.filler_counts.update(current_metrics.fillers.fillers_found)

        # Keep live score consistent with final score by using session-aggregated metrics.
        aggregated_metrics = await self.aggregate_session_metrics(session_id)
        score = calculate_score(aggregated_metrics)

        return RealtimeMetricsMessage(
            session_id=session_id,
            transcript_partial=transcript.text,
            metrics=aggregated_metrics,
            score=score,
        )

    async def should_emit_feedback(self, session_id: str) -> bool:
        """Check if feedback interval has elapsed for the given session."""

        session = await self.get_or_create(session_id)
        now = time.monotonic()
        interval = max(1, get_settings().feedback_interval_seconds)

        if now - session.last_feedback_at >= interval:
            session.last_feedback_at = now
            return True
        return False

    async def aggregate_session_metrics(self, session_id: str) -> AllMetrics:
        """Aggregate all chunk metrics into one session-level metrics object."""

        session = await self.get_or_create(session_id)
        history = session.all_metrics_history

        if not history:
            return AllMetrics(
                duration_seconds=0.0,
                speech_rate=0.0,
                whisper_confidence=0.0,
                pitch=pitch_variation(array([], dtype=float)),
                energy_level=0.0,
                pauses=pause_analysis([], 0.0),
                fillers=detect_fillers("", duration_seconds=60.0),
                transcript_length=0,
            )

        settings = get_settings()
        total_duration = float(sum(item.duration_seconds for item in history))
        valid_for_pace = [
            item
            for item in history
            if item.duration_seconds >= settings.speech_rate_min_duration_seconds
            and 0.0 <= item.speech_rate <= settings.speech_rate_max_wpm
        ]
        pace_history = valid_for_pace or history
        pace_duration = float(sum(item.duration_seconds for item in pace_history))
        weighted_speech_rate = (
            sum(item.speech_rate * item.duration_seconds for item in pace_history) / max(pace_duration, 1e-6)
        )
        weighted_confidence = (
            sum(item.whisper_confidence * item.duration_seconds for item in history) / max(total_duration, 1e-6)
        )
        avg_energy = float(sum(item.energy_level for item in history) / len(history))

        transcript_len = sum(item.transcript_length for item in history)
        combined_text = " ".join(part for part in session.transcript_parts if part).strip()
        fillers = detect_fillers(combined_text, duration_seconds=total_duration)

        # Rebuild pause metrics from complete word timeline for more accurate report.
        pauses = pause_analysis(session.all_words, total_duration)

        # Compute pitch metrics average from per-chunk values.
        pitch_mean = float(sum(item.pitch.mean_pitch for item in history) / len(history))
        pitch_std = float(sum(item.pitch.std_pitch for item in history) / len(history))
        pitch_variation_avg = float(sum(item.pitch.variation_score for item in history) / len(history))

        # SECURITY: If we have 2 words or less, it's likely noise or accidental sound.
        # Zero out metrics to avoid false scores.
        if transcript_len <= 2:
            return AllMetrics(
                duration_seconds=total_duration,
                speech_rate=0.0,
                whisper_confidence=0.0,
                pitch={"mean_pitch": 0.0, "std_pitch": 0.0, "variation_score": 0.0},
                energy_level=avg_energy,
                pauses=pauses,
                fillers=fillers,
                transcript_length=transcript_len,
            )

        return AllMetrics(
            duration_seconds=total_duration,
            speech_rate=weighted_speech_rate,
            whisper_confidence=weighted_confidence,
            pitch={
                "mean_pitch": pitch_mean,
                "std_pitch": pitch_std,
                "variation_score": pitch_variation_avg,
            },
            energy_level=avg_energy,
            pauses=pauses,
            fillers=fillers,
            transcript_length=transcript_len,
        )

    async def generate_feedback_message(self, session_id: str) -> AIFeedbackMessage:
        """Generate asynchronous AI feedback for a session."""

        session = await self.get_or_create(session_id)
        metrics = await self.aggregate_session_metrics(session_id)
        transcript = " ".join(session.transcript_parts).strip()
        feedback = await generate_feedback(metrics, transcript)
        session.last_feedback_text = feedback

        return AIFeedbackMessage(session_id=session_id, feedback=feedback)

    async def finalize_session(self, session_id: str) -> SpeechReport | None:
        """Finalize and remove one session, returning complete speech report.

        If a session was already finalized previously, return the cached report so
        repeated /report calls with the same session_id remain idempotent.
        """

        async with self._lock:
            cached = self._finalized_reports.get(session_id)
            if cached is not None:
                return cached

        async with self._lock:
            session = self._sessions.pop(session_id, None)

        if session is None:
            return None

        metrics = await self.aggregate_for_finalized(session)
        score: ScoreResult = calculate_score(metrics)
        transcript = " ".join(part for part in session.transcript_parts if part).strip()
        feedback = session.last_feedback_text or await generate_feedback(metrics, transcript)

        report = SpeechReport(
            session_id=session_id,
            duration=metrics.duration_seconds,
            transcript_full=transcript,
            metrics=metrics,
            score=score,
            feedback=feedback,
            timestamp=datetime.now(timezone.utc),
        )

        async with self._lock:
            # Keep a bounded cache to avoid unbounded memory growth.
            if len(self._finalized_reports) >= 512:
                oldest_key = next(iter(self._finalized_reports))
                self._finalized_reports.pop(oldest_key, None)
            self._finalized_reports[session_id] = report

        return report

    async def aggregate_for_finalized(self, session: SpeechSession) -> AllMetrics:
        """Aggregate metrics for a session that has already been removed from store."""

        history = session.all_metrics_history
        if not history:
            return AllMetrics(
                duration_seconds=0.0,
                speech_rate=0.0,
                whisper_confidence=0.0,
                pitch={"mean_pitch": 0.0, "std_pitch": 0.0, "variation_score": 0.0},
                energy_level=0.0,
                pauses=pause_analysis([], 0.0),
                fillers=detect_fillers("", duration_seconds=60.0),
                transcript_length=0,
            )

        settings = get_settings()
        total_duration = float(sum(item.duration_seconds for item in history))
        valid_for_pace = [
            item
            for item in history
            if item.duration_seconds >= settings.speech_rate_min_duration_seconds
            and 0.0 <= item.speech_rate <= settings.speech_rate_max_wpm
        ]
        pace_history = valid_for_pace or history
        pace_duration = float(sum(item.duration_seconds for item in pace_history))
        weighted_speech_rate = (
            sum(item.speech_rate * item.duration_seconds for item in pace_history) / max(pace_duration, 1e-6)
        )
        weighted_confidence = (
            sum(item.whisper_confidence * item.duration_seconds for item in history) / max(total_duration, 1e-6)
        )
        avg_energy = float(sum(item.energy_level for item in history) / len(history))

        transcript_len = sum(item.transcript_length for item in history)
        combined_text = " ".join(part for part in session.transcript_parts if part).strip()

        # SECURITY: Filter noise
        if transcript_len <= 2:
            return AllMetrics(
                duration_seconds=total_duration,
                speech_rate=0.0,
                whisper_confidence=0.0,
                pitch={"mean_pitch": 0.0, "std_pitch": 0.0, "variation_score": 0.0},
                energy_level=avg_energy,
                pauses=pause_analysis(session.all_words, total_duration),
                fillers=detect_fillers(combined_text, duration_seconds=total_duration),
                transcript_length=transcript_len,
            )

        return AllMetrics(
            duration_seconds=total_duration,
            speech_rate=weighted_speech_rate,
            whisper_confidence=weighted_confidence,
            pitch={
                "mean_pitch": float(sum(item.pitch.mean_pitch for item in history) / len(history)),
                "std_pitch": float(sum(item.pitch.std_pitch for item in history) / len(history)),
                "variation_score": float(
                    sum(item.pitch.variation_score for item in history) / len(history)
                ),
            },
            energy_level=avg_energy,
            pauses=pause_analysis(session.all_words, total_duration),
            fillers=detect_fillers(combined_text, duration_seconds=total_duration),
            transcript_length=transcript_len,
        )


session_manager = SpeechSessionManager()


async def _send_feedback_if_needed(websocket: WebSocket, session_id: str) -> None:
    """Send asynchronous AI feedback on interval without blocking chunk processing."""

    try:
        if not await session_manager.should_emit_feedback(session_id):
            return
        feedback_msg = await session_manager.generate_feedback_message(session_id)
        await websocket.send_json(feedback_msg.model_dump(mode="json"))
    except Exception as exc:  # pragma: no cover - runtime network issues
        logger.warning("Feedback dispatch failed", extra={"session_id": session_id, "error": str(exc)})


def _decode_base64_audio(payload: str) -> bytes:
    """Decode base64-encoded audio payload."""

    return base64.b64decode(payload)


@router.websocket("/ws/speech/{session_id}")
async def speech_websocket(websocket: WebSocket, session_id: str) -> None:
    """Handle real-time speech analysis over WebSocket."""

    await websocket.accept()
    await session_manager.get_or_create(session_id)
    logger.info("WebSocket connected", extra={"session_id": session_id})

    try:
        while True:
            frame = await websocket.receive()

            if frame.get("type") == "websocket.disconnect":
                break

            raw_bytes = frame.get("bytes")
            if raw_bytes is not None:
                realtime = await session_manager.process_audio_chunk(session_id, raw_bytes)
                await websocket.send_json(realtime.model_dump(mode="json"))
                asyncio.create_task(_send_feedback_if_needed(websocket, session_id))
                continue

            text_data = frame.get("text")
            if text_data is None:
                continue

            payload = GenericWSMessage.model_validate_json(text_data).get_payload()
            message_type = str(payload.get("type", "")).strip()

            if message_type == "audio_chunk":
                base64_audio = str(payload.get("audio_base64", ""))
                audio_bytes = _decode_base64_audio(base64_audio)
                realtime = await session_manager.process_audio_chunk(session_id, audio_bytes)
                await websocket.send_json(realtime.model_dump(mode="json"))
                asyncio.create_task(_send_feedback_if_needed(websocket, session_id))
            elif message_type == "set_topic":
                session = await session_manager.get_or_create(session_id)
                session.topic_hint = str(payload.get("topic", "")).strip()[:200]
                await websocket.send_json({"type": "topic_set", "session_id": session_id})
            elif message_type == "end_session":
                report = await session_manager.finalize_session(session_id)
                if report is None:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"No active session found for '{session_id}'",
                    })
                else:
                    final_message = FinalReportMessage(session_id=session_id, report=report)
                    await websocket.send_json(final_message.model_dump(mode="json"))
                await websocket.close()
                break
            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": f"Unsupported message type '{message_type}'",
                    }
                )
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected", extra={"session_id": session_id})
    except json.JSONDecodeError as exc:
        logger.warning("Invalid JSON payload", extra={"session_id": session_id, "error": str(exc)})
        await websocket.close(code=1003)
    except Exception as exc:  # pragma: no cover - runtime behavior
        logger.exception("Unhandled WebSocket error", extra={"session_id": session_id, "error": str(exc)})
        await websocket.close(code=1011)
