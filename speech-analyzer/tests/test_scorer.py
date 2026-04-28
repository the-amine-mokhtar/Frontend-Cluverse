"""Unit tests for scorer fallback behavior."""

from __future__ import annotations

from app.models.schemas import AllMetrics, FillerResult, PauseMetrics, PitchMetrics
from app.pipeline.scorer import calculate_score


def test_calculate_score_returns_valid_result() -> None:
    """calculate_score should always return a bounded score and valid level."""

    metrics = AllMetrics(
        duration_seconds=60.0,
        speech_rate=135.0,
        whisper_confidence=0.88,
        pitch=PitchMetrics(mean_pitch=170.0, std_pitch=30.0, variation_score=65.0),
        energy_level=62.0,
        pauses=PauseMetrics(pause_count=6, avg_pause_duration=0.5, long_pauses=1),
        fillers=FillerResult(fillers_found={"euh": 2}, total_count=2, rate_per_minute=2.0),
        transcript_length=130,
    )

    score = calculate_score(metrics)

    assert 0.0 <= score.global_score <= 100.0
    assert score.level in {"BEGINNER", "INTERMEDIATE", "ADVANCED"}
