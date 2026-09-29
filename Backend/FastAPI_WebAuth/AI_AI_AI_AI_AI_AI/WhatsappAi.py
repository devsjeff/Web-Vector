"""
WhatsappAi.py - the ONLY file that talks to the LLM.

Works with any OpenAI-compatible API (OpenRouter by default, or OpenAI, or a local server).
Change LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in Backend/.env - no code change needed.
"""
import re

from openai import AsyncOpenAI

from FastAPI_WebAuth.Common_configs import LLM_API_KEY, LLM_BASE_URL, LLM_MAX_TOKENS, LLM_MODEL, LLM_TIMEOUT_SECONDS

MAX_REPLY_CHARS = 3500

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    """Created on first use (not at import), so the app can start and show a clear error if the key is missing."""
    global _client
    if _client is None:
        if not LLM_API_KEY:
            raise RuntimeError("No LLM key found. Set OPENROUTER_API_KEY (or LLM_API_KEY / OPENAI_API_KEY) in Backend/.env")
        _client = AsyncOpenAI(
            base_url=LLM_BASE_URL,
            api_key=LLM_API_KEY,
            timeout=LLM_TIMEOUT_SECONDS,
            max_retries=2,
            default_headers={"X-Title": "Web Vector"},
        )
    return _client


def clean_reply(text: str) -> str:
    """Some reasoning models put their thinking in <think>...</think>. The contact must never see that."""
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"</?think>", "", text, flags=re.IGNORECASE).strip()
    return text[:MAX_REPLY_CHARS]


async def generate_reply(messages: list[dict]) -> str:
    """messages = [{"role": "system"|"user"|"assistant", "content": str}, ...]. Returns "" if the model said nothing."""
    response = await _get_client().chat.completions.create(model=LLM_MODEL, messages=messages, max_tokens=LLM_MAX_TOKENS, temperature=0.7)
    if not response.choices:
        return ""
    return clean_reply(response.choices[0].message.content or "")
