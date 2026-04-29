"""Unit tests for acoustic feature extraction."""

from __future__ import annotations

import numpy as np

from app.pipeline.acoustic import energy_level, pause_analysis, speech_rate
from app.models.schemas import TranscriptWord


def test_speech_rate_computation() -> None:
    """speech_rate should compute words per minute."""

    assert speech_rate(words=30, duration=15.0) == 120.0


def test_energy_level_bounds() -> None:
    """energy_level should remain in 0-100 range."""

    waveform = np.ones(16000, dtype=np.float32) * 0.5
    value = energy_level(waveform)
    assert 0.0 <= value <= 100.0


def test_pause_analysis_detects_long_pauses() -> None:
    """pause_analysis should identify pauses between words."""

    words = [
        TranscriptWord(word="bonjour", start=0.0, end=0.4),
        TranscriptWord(word="a", start=3.0, end=3.2),
        TranscriptWord(word="tous", start=3.3, end=3.6),
    ]
    result = pause_analysis(words, total_duration=4.0)
    assert result.pause_count >= 1
    assert result.long_pauses >= 1
