#!/usr/bin/env bash
# ============================================================================
# End-to-end test: Node <-> Kafka <-> Python <-> Postgres <-> (fake) AI.
#
#   docker compose up -d postgres kafka      # once
#   bash Backend/tests/run_e2e.sh            # from the project root
#
# It creates a throw-away user + assistant settings in Postgres, starts the REAL Python worker and a FAKE
# OpenAI-compatible server (so no API key / internet needed), runs the Node test, then cleans up everything.
# ============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/Backend"
PY="${PYTHON:-python3}"; [ -x "$ROOT/Backend/.venv/bin/python" ] && PY="$ROOT/Backend/.venv/bin/python"
RUN="$(date +%s)"
export KAFKA_TOPIC_INCOMING="e2e.incoming.$RUN" KAFKA_TOPIC_OUTGOING="e2e.outgoing.$RUN"
export KAFKA_WORKER_GROUP_ID="e2e-worker-$RUN" KAFKA_GROUP_ID="e2e-node-$RUN"
export LLM_BASE_URL="http://127.0.0.1:9911" LLM_API_KEY="fake-key" PYTHONUNBUFFERED=1
export E2E_EMAIL="e2e-$RUN@example.com" E2E_LLM_URL="http://127.0.0.1:9911"

cleanup() { kill "${LLM_PID:-}" "${WORKER_PID:-}" 2>/dev/null || true; (cd "$ROOT/Backend" && "$PY" -m tests.e2e_setup teardown "$E2E_EMAIL") || true; }
trap cleanup EXIT

"$PY" -m tests.e2e_setup setup "$E2E_EMAIL"
"$PY" -m tests.fake_llm & LLM_PID=$!
"$PY" -m FastAPI_WebAuth.Kafka.whatsapp_kafka > "${TMPDIR:-/tmp}/e2e-worker.log" 2>&1 & WORKER_PID=$!
sleep 4

cd "$ROOT"
npx tsx --test Backend/Node/tests/e2e_bridge.e2e.ts
