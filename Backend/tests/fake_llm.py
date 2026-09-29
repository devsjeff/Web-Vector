"""
A tiny fake OpenAI-compatible server for tests (so tests never need a real API key or internet).

    python -m tests.fake_llm            # listens on 127.0.0.1:9911

  POST /chat/completions   -> replies "[fake-llm] <last user message>" and remembers the request
  GET  /_requests          -> every request received so far (tests read the prompt from here)
  POST /_fail_next         -> the next chat call returns HTTP 500 (to test error handling)
"""
import time

import uvicorn
from fastapi import FastAPI, HTTPException, Request

app = FastAPI()
received: list[dict] = []
fail_next = {"count": 0}


@app.post("/chat/completions")
async def chat(request: Request):
    body = await request.json()
    if fail_next["count"] > 0:
        fail_next["count"] -= 1
        raise HTTPException(status_code=500, detail="fake llm failure")
    received.append(body)
    last_user = next((m["content"] for m in reversed(body["messages"]) if m["role"] == "user"), "")
    return {
        "id": "fake-1",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": body.get("model", "fake"),
        "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": f"[fake-llm] {last_user}"}}],
        "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
    }


@app.get("/_requests")
async def requests_seen():
    return received


@app.post("/_fail_next")
async def make_next_fail(count: int = 1):
    fail_next["count"] = count
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=9911, log_level="warning")
