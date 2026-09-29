"""
test_contact_memory.py - Unit tests for per-contact custom configuration,
sarcastic style presets, pgvector embeddings, and memory retrieval logic.
"""
import pytest

from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.embeddings import (
    cosine_similarity,
    fallback_embedding,
    generate_embedding,
)
from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.prompt_builder import (
    DEFAULT_ASSISTANT_CONFIG,
    STYLE_PRESETS,
    build_system_prompt,
)
from tests.conftest import CONFIG


def test_style_presets_include_sarcasm_and_roast():
    assert "sarcastic" in STYLE_PRESETS
    assert "roast" in STYLE_PRESETS
    assert "witty" in STYLE_PRESETS
    assert "sarcasm" in STYLE_PRESETS["sarcastic"].lower()
    assert "roast" in STYLE_PRESETS["roast"].lower()


def test_contact_config_overrides_tone_to_sarcasm():
    contact_cfg = {
        "whatsappNumber": "919876543210",
        "contactName": "Vikram",
        "enabled": True,
        "toneStyle": "sarcastic",
        "task": "Answer playfully but accurately",
    }
    prompt = build_system_prompt(
        config=CONFIG,
        contact_name="Vikram",
        contact_number="919876543210",
        contact_config=contact_cfg,
    )
    assert "sarcasm" in prompt.lower()
    assert "Vikram (WhatsApp number 919876543210)" in prompt
    assert "Answer playfully but accurately" in prompt


def test_contact_config_fallback_to_global_when_tone_is_global():
    # If contact toneStyle is 'global', it should retain the global responseStyle
    contact_cfg = {
        "whatsappNumber": "919876543210",
        "enabled": True,
        "toneStyle": "global",
    }
    # CONFIG has responseStyle: sarcastic
    prompt = build_system_prompt(
        config=CONFIG,
        contact_number="919876543210",
        contact_config=contact_cfg,
    )
    assert "sarcasm" in prompt.lower()


def test_contact_config_fallback_to_global_when_disabled():
    contact_cfg = {
        "whatsappNumber": "919876543210",
        "enabled": False,
        "toneStyle": "sarcastic",
        "task": "Custom contact task that should be ignored",
    }
    prompt = build_system_prompt(
        config=CONFIG,
        contact_number="919876543210",
        contact_config=contact_cfg,
    )
    assert "Custom contact task that should be ignored" not in prompt
    assert "Book haircut appointments" in prompt


def test_embedding_generation_length_and_normalization():
    vec = fallback_embedding("Hello from WhatsApp memory test")
    assert len(vec) == 768
    # Test normalization: magnitude should be approximately 1.0
    mag = sum(x * x for x in vec) ** 0.5
    assert abs(mag - 1.0) < 1e-4


@pytest.mark.asyncio
async def test_async_generate_embedding_deterministic():
    vec1 = await generate_embedding("Schedule dentist appointment at 3pm")
    vec2 = await generate_embedding("Schedule dentist appointment at 3pm")
    assert len(vec1) == 768
    assert vec1 == vec2


def test_cosine_similarity_accuracy():
    vec_a = fallback_embedding("I love coffee in the morning")
    vec_b = fallback_embedding("I love coffee in the morning")
    vec_c = fallback_embedding("Quantum physics and astrophysical dynamics")

    sim_identical = cosine_similarity(vec_a, vec_b)
    sim_different = cosine_similarity(vec_a, vec_c)

    assert abs(sim_identical - 1.0) < 1e-4
    assert sim_different < sim_identical


def test_prompt_includes_retrieved_memories():
    memories = [
        {"memoryText": "Contact is allergic to penicillin"},
        {"memoryText": "Contact prefers evening appointments"},
    ]
    prompt = build_system_prompt(
        config=DEFAULT_ASSISTANT_CONFIG,
        contact_number="919876543210",
        retrieved_memories=memories,
    )
    assert "allergic to penicillin" in prompt
    assert "evening appointments" in prompt
    assert "PgVector long-term memory" in prompt
