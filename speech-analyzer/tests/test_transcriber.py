"""Unit tests for transcriber helpers."""

from __future__ import annotations

from app.pipeline.transcriber import decode_audio_bytes


def test_decode_audio_bytes_invalid_input_returns_empty_array() -> None:
    """decode_audio_bytes should return an empty array when data cannot be decoded."""

    audio = decode_audio_bytes(b"not-a-valid-audio-file")
    assert audio.size == 0
