# Web Vector

A WhatsApp AI assistant you configure from a dashboard. Someone messages your WhatsApp -> an AI answers **as you**,
using the role, style, task and rules you saved. Each user links their own WhatsApp by scanning a QR code.

```
 Browser (Next.js :3000)
   |  login / signup / assistant settings                 QR / status / logout
   v                                                              v
 FastAPI :8000 (Python)                                  Fastify :3001 (Node)
   |  Postgres: users + assistant settings                  |  Baileys = one WhatsApp socket per user
   |  Redis:    OTP codes                                    |  MongoDB: WhatsApp login data (no re-scan)
   |                                                         |
   |        +---------------- Kafka ----------------+       |
   |        |  whatsapp.incoming   (Node -> Python) |<------+  contact wrote: last 20 messages + new one
   +------->|  whatsapp.outgoing   (Python -> Node) |------>+  AI reply -> sent on WhatsApp
            +---------------------------------------+
                   ^
        Python worker (whatsapp_kafka.py): reads the user's settings from Postgres,
        builds the prompt, asks the LLM (OpenRouter by default), writes the reply back.
```

The login cookie is a JWT that **FastAPI signs and Fastify verifies with the same `JWT_SECRET`**.

## Run it

You need: Docker, Node 20+, Python 3.11+.

```bash
# 1. databases + Kafka
docker compose up -d

# 2. config (one .env for Python AND Node)
cp Backend/.env.example Backend/.env
#    fill in: JWT_SECRET, OPENROUTER_API_KEY   (+ EMAIL_ADDRESS / EMAIL_APP_PASSWORD for signup OTP mails)

# 3. Python (needs its own terminal for each of the two commands at the bottom)
cd Backend
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn FastAPI_WebAuth.Main:app --reload --port 8000    # API: login, signup, assistant settings
python -m FastAPI_WebAuth.Kafka.whatsapp_kafka           # worker: Kafka <-> Postgres <-> AI
cd ..

# 4. Node: Fastify + Baileys + Kafka bridge
npm install
npm start

# 5. Frontend
cd Frontend/web_app && npm install && npm run dev        # http://localhost:3000
```

Then: sign up -> **Application -> WhatsApp -> Connect** -> scan the QR (WhatsApp -> Linked devices) ->
message your number from another phone. A cautious default assistant replies as soon as WhatsApp connects;
open **Assistant behavior** and press **Update settings** any time to customize it.

> Default replies use the sender's language, stay concise, and avoid inventing facts or making commitments.

## What the assistant does with a message

1. Node collects the contact's messages for `REPLY_DEBOUNCE_MS` (2s) so three quick texts get **one** answer.
2. Node sends `{ email, numbers, last 20 messages, new message }` to Kafka. Duplicates, groups, your own
   "message yourself" chat, old backlog and contacts writing more than 5 messages/minute are ignored.
3. Python loads that user's settings from Postgres and builds the system prompt: **role, language, response style,
   memory instructions, main task, your rules**. Built-in safety rules are always added on top of your rules and
   cannot be replaced by them (no leaking other chats, ignore "forget your instructions", no secrets/OTPs ...).
4. The LLM answers, Python writes the reply to Kafka, Node sends it from the right user's WhatsApp.

## Tests

```bash
docker compose up -d                                  # tests use the real Postgres / Redis / Mongo / Kafka
cd Backend && pip install -r requirements-dev.txt
pytest                                                # auth flow, settings API, prompt builder, Kafka worker
cd .. && npm run typecheck && npm test                # Node: chat pipeline + Mongo auth store
bash Backend/tests/run_e2e.sh                         # WHOLE loop: Node -> Kafka -> Python -> Postgres -> AI -> Kafka -> Node
```

The tests never call a real LLM or WhatsApp (`Backend/tests/fake_llm.py` is a tiny fake OpenAI server, the
end-to-end test uses a fake WhatsApp socket).
**Not covered by automatic tests:** the real Baileys connection - scanning a QR with a real phone and receiving
real WhatsApp messages. Test that by hand once (step "Then:" above).

## Settings (`Backend/.env`)

| Variable | Meaning |
|---|---|
| `JWT_SECRET` | Same value for Python and Node. Required when `DEV_MODE=false` / `FASTIFY_NODE_ENV=production`. |
| `OPENROUTER_API_KEY`, `LLM_MODEL` | Any OpenAI-compatible API works: set `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (OpenAI, a local server ...). |
| `MAX_SESSIONS` | Max WhatsApp sockets at once (default 10). Extra users get "server is full". |
| `HISTORY_SIZE` | Older messages sent to the AI with the new one (default 20). |
| `REPLY_DEBOUNCE_MS` | Wait for more messages before answering (default 2000). |
| `CONTACT_RATE_LIMIT_PER_MIN` | A contact writing more than this is ignored (default 5). |
| `EVENT_MAX_AGE_SECONDS` | Kafka events older than this are dropped, never replayed to real people (default 900). |

## Folders

```
Backend/FastAPI_WebAuth/   Python: Main.py (API), Routes/ (auth + settings), db/ (Postgres), Cache/ (Redis OTP),
                           AI_AI_AI_AI_AI_AI/ (prompt_builder.py + WhatsappAi.py = LLM), Kafka/whatsapp_kafka.py (worker)
Backend/Node/              Fastify/ (server + routes), Baileys/ (CreateSession = sessions, ChatPipeline = history/debounce,
                           BaileysApi = what the routes call), Mongo/ (WhatsApp login store), Kafka/ (kafkajs bridge), Auth/ (JWT)
Backend/tests/             pytest + fake LLM + end-to-end script        Backend/Node/tests/   Node tests
Frontend/web_app/          Next.js dashboard
```

## Known limits (good next steps)

- Chat history lives in Node memory: after a Node restart the AI only knows messages from that moment on
  (users stay linked, they do not need to scan again). Persisting it (Mongo / the `memory` pgvector table) is the next step.
- Only text messages in direct chats are handled (no groups, voice notes, images).
- Baileys is an unofficial WhatsApp Web library: fine for a project/demo, use the official WhatsApp Business API for a real product.
- If the LLM is down for one message, that message gets no reply (the worker logs it and moves on).

## Troubleshooting

- **No reply at all:** is the Python worker running, is WhatsApp connected, and is an LLM key set? Check the worker log
  (`[worker] in:` / `out:` lines) and the Node log (`[kafka] ready`, `replied to ...`).
- **`No LLM key found` in the worker log:** `OPENROUTER_API_KEY` is empty in `Backend/.env`.
- **QR never appears / 504:** WhatsApp Web version changed or no internet from Node; look at the Node log, then retry.
- **401 from Fastify but you are logged in:** `JWT_SECRET` differs between Python and Node (they read the same `Backend/.env`).
- **Kafka not reachable:** `docker compose ps`; Kafka needs ~30s after `up`. Both Node and Python retry on start.
