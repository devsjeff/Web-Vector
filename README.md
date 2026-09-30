# Web-Vector

**An Event-Driven AI Automation Platform with PgVector Semantic Memory & Per-Contact Personas.**

Web-Vector turns conversational channels (WhatsApp, Webhooks, APIs) into an autonomous workflow system. It features **768-dimensional PgVector long-term semantic memory**, an adaptive **per-contact persona engine (with unique tones like playful sarcasm, witty banter, or corporate polish)**, and real-time chat volume intelligence.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |   Next.js 16 Web Dashboard (:3000)   |
                      |   - Phone Number & Chat Count Search  |
                      |   - Custom Sarcastic/Tone Personas    |
                      |   - PgVector Semantic Memory Bank     |
                      |   - Global Assistant Behavior Studio  |
                      +---------------------------------------+
                                  |                 |
                   Auth / Config  |                 | QR / Status / Logout
                                  v                 v
                 +----------------------+     +----------------------+
                 | FastAPI :8000 Python |     |  Fastify :3001 Node  |
                 | - Users & JWT Auth   |     | - Baileys WA Sockets |
                 | - Contact Personas   |     | - Mongo Auth Store   |
                 | - PgVector Memories  |     | - Message Debouncing |
                 +----------------------+     +----------------------+
                            |                            |
                            |       +------------+       |
                            |       |   Kafka    |       |
                            |       | Topic: in  |<------+ (Debounced incoming messages)
                            +------>| Topic: out |------>+ (AI Replies -> WhatsApp)
                                    +------------+
                                          ^
                                          |
                      +---------------------------------------+
                      | Python Worker (whatsapp_kafka.py)     |
                      | 1. Read event (email, contact number) |
                      | 2. Increment contact chat count       |
                      | 3. Query PgVector (cosine similarity) |
                      | 4. Load contact persona / sarcasm     |
                      |    (Falls back to global if unset)    |
                      | 5. Generate LLM response              |
                      | 6. Commit turn into PgVector memory   |
                      | 7. Send reply to Kafka outgoing       |
                      +---------------------------------------+
```

---

## Core Capabilities

### 1. PgVector 768-Dimensional Semantic Memory
- **Persistent Recall**: Conversations and facts are converted to 768-dimensional vector embeddings using cosine distance (`<=>`).
- **Zero Amnesia**: When an incoming message arrives, the worker queries PgVector for relevant past conversations for that `(email, whatsapp_number)` pair and injects them into the system prompt.
- **Auto-Commit**: Each completed interaction turn is automatically indexed into PostgreSQL via `pgvector`.
- **Manual Fact Storing**: Add custom facts or notes directly from the dashboard to seed knowledge.

### 2. Dynamic Per-Contact Personas & Tones (Sarcasm, Banter, Boss, Love)
- **Per-Contact Overrides**: Configure specific speaking tones per contact number:
  - 🎭 **Sarcastic**: Sharp, witty dry humor and playful banter.
  - 🔥 **Playful Roast**: Friendly teasing and humorous comebacks.
  - ⚡ **Witty**: Clever wordplay and fast-thinking quips.
  - 👔 **Boss / Executive**: Executive-level respect, structured promptness, and concise professional updates.
  - ❤️ **Loved One**: Warm, deeply affectionate, sweet, caring, and gentle partner-level tone.
  - 🤝 **Friendly**: Warm, encouraging, casual, and supportive.
  - 💼 **Professional**: Structured, courteous, and corporate-focused.
  - 😎 **Cool**: Relaxed, casual, short confident sentences.
  - ✍️ **Custom**: Tailored prompt instructions per phone number.
- **Dynamic Sarcasm & Banter Adaptation for Friends**:
  - When a contact is recognized as a friend (e.g. `Rahul Friend`, `Amit Bro`, `Bestie`), the system monitors incoming messages: if the friend gets cheeky, naughty, or sarcastic, the agent dynamically mirrors their playful sarcasm and roasts back with affectionate wit!
- **Intelligent Global Fallback**: If a contact does not have custom settings (or if the override is toggled off), the assistant automatically falls back to your global workspace settings.

### 3. Contact & Chat Volume Intelligence & Name Syncing
- **Number Search & Scrollable View**: Switch between Card Grid and Dense Scrollable List views with phone numbers prominently displayed.
- **Real-time Global vs Custom Indicators**: Clear `[🌐 Global Settings Active]` vs `[⚡ Custom: Sarcastic]` badges on every contact.
- **Contact Name Sync & Relationship Sensing**:
  - Click `✏️ Sync Name` to sync or update display names (`POST /App/contact_name`).
  - Real-time relationship detection automatically identifies Boss, Loved One, Friend, or Standard contacts and guides agent tone.
- **Number of Chats Counter**: View message counts and interaction frequencies per contact (`chatCount`).
- **Bulk Custom Reset**: Delete all custom overrides in one click to revert all contacts to global defaults.

### 4. WhatsApp Automation Hub
- **Baileys Web Socket Engine**: Connect via QR scan (WhatsApp -> Linked devices).
- **Session Persistence**: Credentials stored in MongoDB so Node restarts do not require re-scanning.
- **Anti-Spam & Debounce**: Groups quick sequential messages into a single 2-second debounced batch. Contacts sending >5 msgs/min are rate-limited.

### 5. Multi-Channel & Workflow Automations
- **Webhooks & API Triggers**: Incoming and outgoing HTTP webhooks for CRM and calendar syncing.
- **Scheduled Actions**: Support for automated check-ins and cron jobs.

---

## Quickstart Guide

### Prerequisites
- **Node.js 20+**
- **Python 3.11+**
- **Docker & Docker Compose** (for PostgreSQL with `pgvector`, Redis, Kafka, MongoDB)

### 1. Start Infrastructure
```bash
docker compose up -d
```
*This launches:*
- `postgres`: `pgvector/pgvector:pg16` on port `5432`
- `redis`: Redis 7 on port `6379`
- `kafka`: Apache Kafka 3.9 on port `9092`
- `mongodb`: MongoDB 8.3 on port `27017`

### 2. Configure Environment
Create `Backend/.env` (shared by Python and Node):
```env
DEV_MODE=true
JWT_SECRET=dev-only-secret-change-me-before-production-0123456789

# Database URLs
DATABASE_URL=postgresql+asyncpg://webvector:webvector@localhost:5432/webvector
REDIS_URL=redis://localhost:6379/0
MONGODB_URL=mongodb://localhost:27017

# Kafka
KAFKA_BROKERS=localhost:9092

# LLM (OpenRouter / OpenAI / Local)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your-openrouter-or-openai-api-key
LLM_MODEL=openrouter/free
```

### 3. Start Python API & Worker
```bash
# Terminal 1: FastAPI API Server
cd Backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn FastAPI_WebAuth.Main:app --reload --port 8000

# Terminal 2: Python Kafka Automation Worker
cd Backend
source .venv/bin/activate       # Windows: .venv\Scripts\activate
python -m FastAPI_WebAuth.Kafka.whatsapp_kafka
```

### 4. Start Node Fastify & Baileys Bridge
```bash
# Terminal 3
npm install
npm start
```

### 5. Start Next.js Frontend
```bash
# Terminal 4
cd Frontend/web_app
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## REST API Reference

### Global Assistant Settings
- `GET /App/whatsapp_config`: Retrieve current global assistant settings.
- `POST /App/whatsapp_config`: Update global assistant language, role, memory, rules, style, task.

### Contacts & Chat Personas
- `GET /App/contacts?query=`: Returns contacts, number of chats, memory counts, and custom tone status.
- `GET /App/contact_configs`: Returns all contacts that currently have custom persona configurations set.
- `GET /App/contact_config?number={phone}`: Returns custom configuration for a specific contact.
- `POST /App/contact_config`: Save custom speaking style (e.g. sarcastic), custom task, and notes for a contact.
- `DELETE /App/contact_config?number={phone}`: Remove contact override and revert to global settings (or pass `number=all`).
- `DELETE /App/contact_configs/all`: Delete custom settings for all contacts at once, reverting everyone to global settings.


### PgVector Memories
- `GET /App/memories?number={phone}&query={search}`: Semantic vector search or list memories.
- `POST /App/memories`: Embed and store a new 768-dim fact into PgVector.
- `DELETE /App/memories/{id}`: Delete a specific memory by ID.

### Automations Overview
- `GET /App/automations`: High-level metrics on active channels, personas, and memory storage.

---

## Testing

```bash
# Run unit tests for prompt builder, per-contact custom tones & sarcasm, and PgVector embeddings:
cd Backend
python -m pytest tests/test_prompt_builder.py tests/test_contact_memory.py

# Run Node pipeline tests:
npm test
```

---

## License
MIT License. Built with Next.js, FastAPI, Fastify, Baileys, Apache Kafka, and PostgreSQL PgVector.
