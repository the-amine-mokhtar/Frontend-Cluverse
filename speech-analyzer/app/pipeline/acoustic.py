"""Acoustic feature extraction utilities based on librosa."""

from __future__ import annotations

import logging

import librosa
import numpy as np

from app.config.settings import get_settings
from app.models.schemas import PauseMetrics, PitchMetrics, TranscriptWord

logger = logging.getLogger(__name__)


def speech_rate(words: int, duration: float) -> float:
    """Compute speaking rate in words per minute."""

    # Increase minimum duration to avoid unrealistic WPM spikes for very short segments.
    effective_duration = max(duration, 1.5) 
    raw_wpm = float((max(words, 0) / effective_duration) * 60.0)
    
    # Cap and floor to keep it realistic
    return float(np.clip(raw_wpm, 0.0, 220.0))


def pitch_variation(audio_np: np.ndarray) -> PitchMetrics:
    """Estimate mean pitch, standard deviation, and normalized variation score."""

    if audio_np.size == 0:
        return PitchMetrics(mean_pitch=0.0, std_pitch=0.0, variation_score=0.0)

    try:
        f0 = librosa.yin(
            audio_np,
            fmin=75,
            fmax=400,
            sr=16000,
            frame_length=1024,
            hop_length=256,
        )
        voiced = f0[np.isfinite(f0)]
        if voiced.size == 0:
            return PitchMetrics(mean_pitch=0.0, std_pitch=0.0, variation_score=0.0)

        mean_pitch = float(np.mean(voiced))
        std_pitch = float(np.std(voiced))
        normalized = np.clip((std_pitch / max(mean_pitch, 1.0)) * 250.0, 0.0, 100.0)
        return PitchMetrics(
            mean_pitch=mean_pitch,
            std_pitch=std_pitch,
            variation_score=float(normalized),
        )
    except Exception as exc:  # pragma: no cover - librosa internals may vary
        logger.warning("Pitch extraction failed", extra={"error": str(exc)})
        return PitchMetrics(mean_pitch=0.0, std_pitch=0.0, variation_score=0.0)


def energy_level(audio_np: np.ndarray) -> float:
    """Compute RMS-based energy normalized on a 0-100 scale."""

    if audio_np.size == 0:
        return 0.0

    rms = float(np.sqrt(np.mean(np.square(audio_np))))
    scaled = np.clip(rms * 250.0, 0.0, 100.0)
    return float(scaled)


def pause_analysis(words: list[TranscriptWord], total_duration: float) -> PauseMetrics:
    """Analyze pauses from adjacent word timestamps."""

    if total_duration <= 0 or not words:
        return PauseMetrics(pause_count=0, avg_pause_duration=0.0, long_pauses=0)

    ordered = sorted(words, key=lambda item: item.start)
    pauses: list[float] = []

    for current, nxt in zip(ordered, ordered[1:]):
        gap = max(0.0, nxt.start - current.end)
        if gap >= 0.2:
            pauses.append(gap)

    avg_pause = float(np.mean(pauses)) if pauses else 0.0
    long_pauses = sum(1 for value in pauses if value > 2.0)

    return PauseMetrics(
        pause_count=len(pauses),
        avg_pause_duration=avg_pause,
        long_pauses=long_pauses,
    )
