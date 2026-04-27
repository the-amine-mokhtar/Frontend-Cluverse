"""Asynchronous LLM feedback generation with provider fallback and rule-based backup."""

from __future__ import annotations

import logging

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from app.config.settings import get_settings
from app.models.schemas import AllMetrics

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Tu es un coach expert en prise de parole. "
    "Donne un feedback bienveillant en 2-3 phrases maximum, "
    "avec 1 conseil actionnable immediat."
)


def _rule_based_feedback(metrics: AllMetrics) -> str:
    """Return deterministic feedback when LLM provider is unavailable."""

    suggestions: list[str] = []
    reliable_pace = metrics.whisper_confidence >= 0.82

    if reliable_pace and metrics.speech_rate < 105:
        suggestions.append("Accélère légèrement ton débit pour maintenir l'attention")
    elif reliable_pace and metrics.speech_rate > 185:
        suggestions.append("Ralentis un peu ton débit pour améliorer la clarté")

    if metrics.fillers.rate_per_minute > 3.0:
        suggestions.append("Marque un silence bref avant les idées clés pour réduire les fillers")

    if metrics.pitch.variation_score < 35:
        suggestions.append("Varie davantage l'intonation pour renforcer l'impact")

    if metrics.energy_level < 40:
        suggestions.append("Projette un peu plus la voix sur les mots importants")

    action = suggestions[0] if suggestions else "Continue ainsi et garde un rythme stable avec des pauses maîtrisées"
    return (
        f"Bonne base globale avec un score estimé de {metrics.transcript_length} mots transcrits. "
        f"Ton discours est compréhensible. Conseil immédiat: {action}."
    )


async def _custom_openai_feedback(client: AsyncOpenAI, model: str, metrics: AllMetrics, transcript: str) -> str:
    """Generic OpenAI-compatible feedback generation."""
    user_prompt = f"Score: {metrics.speech_rate} wpm, Transcript: {transcript[:800]}"

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
        max_tokens=180,
    )

    return (response.choices[0].message.content or "").strip()


async def _openai_feedback(metrics: AllMetrics, transcript: str) -> str:
    """Generate feedback using OpenAI async client."""

    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    return await _custom_openai_feedback(client, settings.llm_model, metrics, transcript)


async def _anthropic_feedback(metrics: AllMetrics, transcript: str) -> str:
    """Generate feedback using Anthropic async client."""

    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    user_prompt = (
        "Analyse ces métriques de prise de parole et propose un feedback court.\n"
        f"Métriques: {metrics.model_dump_json()}\n"
        f"Transcript: {transcript[:2000]}"
    )

    response = await client.messages.create(
        model=settings.llm_model,
        max_tokens=180,
        temperature=0.4,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    blocks = [block.text for block in response.content if getattr(block, "text", None)]
    return " ".join(blocks).strip()


async def generate_feedback(metrics: AllMetrics, transcript: str) -> str:
    """Generate short coaching feedback using configured provider with graceful fallback."""

    settings = get_settings()
    provider = settings.llm_provider.lower().strip()

    # SECURITY: Prevent AI from hallucinating feedback on silence/noise
    if metrics.transcript_length <= 1 or metrics.whisper_confidence < 0.25:
        return "Aucune parole claire detectee. Assure-toi que ton micro est bien branche et parle un peu plus fort."

    logger.info("Generating feedback with provider=%s, model=%s", provider, settings.llm_model)

    try:
        if provider == "openai":
            if not settings.openai_api_key:
                raise ValueError("OPENAI_API_KEY is empty")
            feedback = await _openai_feedback(metrics, transcript)
        elif provider == "groq":
            if not settings.groq_api_key:
                raise ValueError("GROQ_API_KEY is empty")
            client = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
            feedback = await _custom_openai_feedback(client, settings.llm_model, metrics, transcript)
        elif provider == "ollama":
            client = AsyncOpenAI(api_key="ollama", base_url=settings.ollama_base_url)
            feedback = await _custom_openai_feedback(client, settings.llm_model, metrics, transcript)
        elif provider == "anthropic":
            if not settings.anthropic_api_key:
                raise ValueError("ANTHROPIC_API_KEY is empty")
            feedback = await _anthropic_feedback(metrics, transcript)
        else:
            raise ValueError(f"Unsupported LLM_PROVIDER '{settings.llm_provider}'")

        return feedback or _rule_based_feedback(metrics)
    except Exception as exc:  # pragma: no cover - depends on network/provider
        logger.error(
            "LLM feedback failed (Provider: %s, Model: %s). Error: %s",
            provider, settings.llm_model, str(exc),
            exc_info=True
        )
        return _rule_based_feedback(metrics)
