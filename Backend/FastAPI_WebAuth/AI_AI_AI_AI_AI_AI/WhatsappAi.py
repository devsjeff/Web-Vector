import os
from openai import AsyncOpenAI

_client = AsyncOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)


async def OPENRouter_ai(message: str) -> str:
    response = await _client.chat.completions.create(
        model="openrouter/free",
        messages=[{"role": "user", "content": message}],
    )
    return response.choices[0].message.content or ""