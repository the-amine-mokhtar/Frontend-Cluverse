"""Regex-based filler word detection for French and English transcripts."""

from __future__ import annotations

import logging
import re
from collections import Counter

from app.models.schemas import FillerResult

logger = logging.getLogger(__name__)

FILLER_WORDS: dict[str, list[str]] = {
    "fr": ["euh", "hm", "bah", "donc", "voila", "du coup", "genre", "ben"],
    "en": ["um", "uh", "like", "you know", "basically", "literally"],
}

_COMPILED_PATTERNS: dict[str, re.Pattern[str]] = {
    phrase: re.compile(rf"\b{re.escape(phrase)}\b", flags=re.IGNORECASE)
    for language_values in FILLER_WORDS.values()
    for phrase in language_values
}


def detect_fillers(transcript: str, duration_seconds: float = 60.0) -> FillerResult:
    """Detect filler words and return counts plus normalized rate per minute."""

    normalized_text = transcript.strip()
    if not normalized_text:
        return FillerResult(fillers_found={}, total_count=0, rate_per_minute=0.0)

    counts: Counter[str] = Counter()
    for phrase, pattern in _COMPILED_PATTERNS.items():
        match_count = len(pattern.findall(normalized_text))
        if match_count > 0:
            counts[phrase] = match_count

    total_count = sum(counts.values())
    safe_duration_minutes = max(duration_seconds / 60.0, 1e-6)
    rate = float(total_count / safe_duration_minutes)

    logger.debug(
        "Filler detection completed",
        extra={"total_fillers": total_count, "rate_per_minute": rate},
    )

    return FillerResult(
        fillers_found=dict(counts),
        total_count=total_count,
        rate_per_minute=rate,
    )
