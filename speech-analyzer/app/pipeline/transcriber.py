"""Whisper-based chunk transcription with model caching and word timestamps."""

from __future__ import annotations

import io
import logging
import threading
import tempfile
from pathlib import Path
from functools import lru_cache

import librosa
import numpy as np
import soundfile as sf
import whisper

from app.config.settings import get_settings
from app.models.schemas import TranscriptResult, TranscriptWord

logger = logging.getLogger(__name__)


class WhisperTranscriber:
    """Thread-safe Whisper transcriber that keeps one model instance in memory."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._lock = threading.Lock()
        self._model: whisper.Whisper | None = None

    def _load_model(self) -> whisper.Whisper:
        """Load Whisper model once and return cached instance."""

        with self._lock:
            if self._model is None:
                logger.info(
                    "Loading Whisper model",
                    extra={"model": self._settings.whisper_model},
                )
                self._model = whisper.load_model(self._settings.whisper_model)
                logger.info("Whisper model loaded successfully")
        return self._model

    def is_model_loaded(self) -> bool:
        """Return True when Whisper model is already loaded in memory."""

        return self._model is not None

    def warmup(self) -> None:
        """Force model loading at application startup."""

        self._load_model()

    def transcribe_chunk(self, audio_bytes: bytes, prompt: str | None = None) -> TranscriptResult:
        """Transcribe one 1-2s audio chunk and return text, language, confidence, and words."""

        audio_np = decode_audio_bytes(audio_bytes)
        if audio_np.size == 0:
            return TranscriptResult(text="", language="unknown", confidence=0.0, words=[])

        model = self._load_model()
        configured_language = (self._settings.transcription_language or "auto").strip().lower()
        whisper_language = None if configured_language in {"", "auto"} else configured_language
        result = model.transcribe(
            audio_np,
            word_timestamps=True,
            fp16=False,
            language=whisper_language,
            task="transcribe",
            initial_prompt=prompt,
            temperature=0.0,
            beam_size=max(1, self._settings.whisper_beam_size),
            best_of=max(1, self._settings.whisper_best_of),
            patience=max(0.0, self._settings.whisper_patience),
            no_speech_threshold=self._settings.whisper_no_speech_threshold,
            logprob_threshold=self._settings.whisper_logprob_threshold,
            compression_ratio_threshold=self._settings.whisper_compression_ratio_threshold,
            condition_on_previous_text=True,
            verbose=False,
        )

        segments = result.get("segments", []) or []
        words: list[TranscriptWord] = []
        segment_confidences: list[float] = []

        for segment in segments:
            avg_logprob = float(segment.get("avg_logprob", -5.0))
            # Calibrate confidence from Whisper avg_logprob to avoid overly pessimistic values.
            calibrated_confidence = float(np.clip((avg_logprob + 2.5) / 2.5, 0.0, 1.0))
            segment_confidences.append(calibrated_confidence)
            segment_words = segment.get("words", []) or []
            for raw_word in segment_words:
                words.append(
                    TranscriptWord(
                        word=str(raw_word.get("word", "")).strip(),
                        start=float(raw_word.get("start", 0.0)),
                        end=float(raw_word.get("end", 0.0)),
                        confidence=(
                            float(np.clip(raw_word.get("probability", 0.0), 0.0, 1.0))
                            if raw_word.get("probability") is not None
                            else None
                        ),
                    )
                )

        confidence = float(np.mean(segment_confidences)) if segment_confidences else 0.0
        language = str(result.get("language") or "unknown")
        text = str(result.get("text") or "").strip()

        return TranscriptResult(
            text=text,
            language=language,
            confidence=float(np.clip(confidence, 0.0, 1.0)),
            words=words,
        )


def decode_audio_bytes(audio_bytes: bytes) -> np.ndarray:
    """Decode raw audio bytes to mono float32 numpy array at configured sample rate."""

    try:
        with io.BytesIO(audio_bytes) as buffer:
            audio, sample_rate = sf.read(buffer, dtype="float32", always_2d=False)
    except Exception:
        # Browser MediaRecorder often emits WebM/Opus chunks that soundfile may
        # fail to parse directly from BytesIO; fallback to file-based decoding.
        try:
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as temp_audio:
                temp_audio.write(audio_bytes)
                temp_path = Path(temp_audio.name)
            audio, sample_rate = librosa.load(str(temp_path), sr=None, mono=False)
        except Exception as exc:  # pragma: no cover - library error details vary
            logger.warning("Unable to decode audio bytes", extra={"error": str(exc)})
            return np.array([], dtype=np.float32)
        finally:
            try:
                if 'temp_path' in locals() and temp_path.exists():
                    temp_path.unlink(missing_ok=True)
            except Exception:
                pass

    audio_np = np.asarray(audio, dtype=np.float32)
    if audio_np.ndim > 1:
        audio_np = np.mean(audio_np, axis=1)

    target_sr = get_settings().audio_sample_rate
    if sample_rate != target_sr and audio_np.size > 0:
        audio_np = librosa.resample(audio_np, orig_sr=sample_rate, target_sr=target_sr)

    return audio_np.astype(np.float32)


@lru_cache(maxsize=1)
def get_transcriber() -> WhisperTranscriber:
    """Return singleton transcriber used by API and WebSocket handlers."""

    return WhisperTranscriber()


def transcribe_chunk(audio_bytes: bytes, prompt: str | None = None) -> TranscriptResult:
    """Convenience function exposing chunk transcription for pipeline composition."""

    return get_transcriber().transcribe_chunk(audio_bytes, prompt=prompt)
