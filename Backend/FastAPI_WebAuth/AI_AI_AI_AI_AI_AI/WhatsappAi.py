import os

from openai import AsyncOpenAI


def build_system_prompt(config) -> str:
    return "\n".join(
        (
            "You are an assistant replying to WhatsApp messages.",
            f"Language: {config.language}",
            f"Role and identity: {config.role_identity}",
            f"Task: {config.task}",
            f"Response style: {config.response_Style}",
            f"Rules and instructions: {config.rules_instructions}",
            f"Memory context: {config.memory_Context}",
            "Follow these settings consistently. Do not claim to have taken actions you did not take.",
        )
    )


async def OPENRouter_ai(message: str, config) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )
    response = await client.chat.completions.create(
        model=os.getenv("OPENROUTER_MODEL", "openrouter/free"),
        messages=[
            {"role": "system", "content": build_system_prompt(config)},
            {"role": "user", "content": message},
        ],
    )
    answer = response.choices[0].message.content or ""
    if not answer.strip():
        raise RuntimeError("OpenRouter returned an empty answer")
    return answer.strip()