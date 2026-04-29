"""Speech quality scoring using an optional ML model with deterministic fallback."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Protocol

import joblib
import numpy as np

from app.models.schemas import AllMetrics, ScoreBreakdown, ScoreResult

logger = logging.getLogger(__name__)


class RegressionModel(Protocol):
    """Protocol for sklearn-style regressors."""

    def predict(self, x: np.ndarray) -> np.ndarray:
        """Predict score from feature matrix."""


def _clip(value: float) -> float:
    """Clip a float score into [0, 100]."""

    return float(np.clip(value, 0.0, 100.0))


def _pace_subscore(speech_rate_value: float, confidence: float) -> float:
    """Return pace score with wider comfort zone and confidence-aware penalty."""

    if 105.0 <= speech_rate_value <= 185.0:
        return 100.0

    if speech_rate_value < 105.0:
        base = _clip(100.0 - (105.0 - speech_rate_value) * 0.95)
    else:
        base = _clip(100.0 - (speech_rate_value - 185.0) * 0.60)

    # When ASR confidence is low, reduce pace penalty weight to avoid false negatives.
    confidence_weight = float(np.clip(confidence, 0.0, 1.0))
    return _clip(base * (0.65 + 0.35 * confidence_weight) + (1.0 - confidence_weight) * 18.0)


def _filler_subscore(rate_per_minute: float) -> float:
    """Return filler score penalizing frequent filler usage."""

    return _clip(100.0 - rate_per_minute * 8.0)


def _energy_subscore(energy: float) -> float:
    """Return energy score emphasizing an appropriate speaking volume range."""

    if 45.0 <= energy <= 75.0:
        return 100.0
    if energy < 45.0:
        return _clip(100.0 - (45.0 - energy) * 2.0)
    return _clip(100.0 - (energy - 75.0) * 2.0)


def _build_breakdown(metrics: AllMetrics) -> ScoreBreakdown:
    """Build weighted breakdown from current metrics."""

    return ScoreBreakdown(
        clarity_score=_clip(metrics.whisper_confidence * 100.0),
        pace_score=_pace_subscore(metrics.speech_rate, metrics.whisper_confidence),
        filler_score=_filler_subscore(metrics.fillers.rate_per_minute),
        pitch_score=_clip(metrics.pitch.variation_score),
        energy_score=_energy_subscore(metrics.energy_level),
    )


def _weighted_score(breakdown: ScoreBreakdown) -> float:
    """Compute weighted final score from sub-scores."""

    return _clip(
        breakdown.clarity_score * 0.25
        + breakdown.pace_score * 0.25
        + breakdown.filler_score * 0.20
        + breakdown.pitch_score * 0.15
        + breakdown.energy_score * 0.15
    )


def _level_from_score(global_score: float) -> str:
    """Map numeric score to user-facing level label."""

    if global_score < 40.0:
        return "BEGINNER"
    if global_score <= 70.0:
        return "INTERMEDIATE"
    return "ADVANCED"


@lru_cache(maxsize=1)
def _load_model() -> RegressionModel | None:
    """Load persisted scorer model if present."""

    model_path = Path(__file__).resolve().parent.parent / "models" / "scorer.pkl"
    if not model_path.exists():
        logger.info("No trained scorer model found, using fallback formula")
        return None

    try:
        model = joblib.load(model_path)
        logger.info("Loaded scorer model", extra={"model_path": str(model_path)})
        return model
    except Exception as exc:  # pragma: no cover - file corruption is external
        logger.exception("Failed to load scorer model", extra={"error": str(exc)})
        return None


def warmup_scorer() -> None:
    """Warm up scorer model cache during startup."""

    _load_model()


def calculate_score(metrics: AllMetrics) -> ScoreResult:
    """Calculate global score from all metrics, using ML model if available."""

    breakdown = _build_breakdown(metrics)
    fallback_score = _weighted_score(breakdown)

    model = _load_model()
    if model is not None:
        feature_vector = np.array(
            [
                [
                    metrics.speech_rate,
                    metrics.pitch.variation_score,
                    metrics.fillers.rate_per_minute,
                    metrics.energy_level,
                    float(metrics.pauses.pause_count),
                ]
            ],
            dtype=np.float32,
        )
        try:
            predicted = float(model.predict(feature_vector)[0])
            global_score = _clip(predicted)
        except Exception as exc:  # pragma: no cover - model runtime errors vary
            logger.exception("Scorer model prediction failed", extra={"error": str(exc)})
            global_score = fallback_score
    else:
        global_score = fallback_score

    # Down-weight scores when evidence is too weak (very short speech or low transcription).
    # SECURITY: If confidence is extremely low, it's probably noise hallucinations. Force 0.
    if metrics.whisper_confidence < 0.25 or metrics.transcript_length <= 1:
        global_score = 0.0
    elif metrics.transcript_length == 0:
        max_without_transcript = 10.0 if metrics.duration_seconds < 5.0 else 20.0
        global_score = min(global_score, max_without_transcript)
    else:
        duration_factor = float(np.clip(metrics.duration_seconds / 30.0, 0.0, 1.0))
        transcript_factor = float(np.clip(metrics.transcript_length / 60.0, 0.0, 1.0))
        confidence_factor = float(np.clip(metrics.whisper_confidence, 0.0, 1.0))
        quality_factor = 0.55 + 0.45 * ((0.4 * duration_factor) + (0.4 * transcript_factor) + (0.2 * confidence_factor))
        global_score = _clip(global_score * quality_factor)

    return ScoreResult(
        global_score=global_score,
        breakdown=breakdown,
        level=_level_from_score(global_score),
    )
