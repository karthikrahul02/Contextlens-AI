from openai import AsyncOpenAI
from app.core.config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    LLM_MODEL,
)

client = AsyncOpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url=OPENROUTER_BASE_URL,
    timeout=60.0,
    max_retries=2,
)


async def generate_response(prompt: str) -> str:
    if not LLM_MODEL:
        raise ValueError("LLM_MODEL is not configured")

    response = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        temperature=0.2,
    )

    return response.choices[0].message.content or ""