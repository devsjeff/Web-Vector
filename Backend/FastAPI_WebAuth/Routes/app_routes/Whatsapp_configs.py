from fastapi import APIRouter, HTTPException, Request, Query

from FastAPI_WebAuth.Auth.jwt import Verify_decode_token
from FastAPI_WebAuth.Routes.config import limiter
from FastAPI_WebAuth.Routes.Types_pydantic import (
    Configs_type,
    ContactConfigType,
    MemoryCreateType,
    ContactNameSyncType,
)
from FastAPI_WebAuth.db.App import (
    Save_WhatsappConfig,
    Read_WhatsappConfig,
    Save_ContactConfig,
    Read_ContactConfig,
    Delete_ContactConfig,
    Delete_AllContactConfigs,
    List_ContactConfigs,
    List_ContactsSummary,
    Update_ContactName,
    Save_ChatMemory,
    Search_ChatMemories,
    List_ChatMemories,
    Delete_ChatMemory,
)
from FastAPI_WebAuth.db.web_db import get_user_by_email
from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.embeddings import generate_embedding
from FastAPI_WebAuth.AI_AI_AI_AI_AI_AI.prompt_builder import detect_contact_relationship

APP_ROUTER = APIRouter()


def _email_from_cookie(request: Request) -> str:
    """The login cookie holds a JWT whose `sub` is the user's email. 401 if missing / invalid."""
    token = request.cookies.get("access_token")
    if token is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    payload = Verify_decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Not logged in")
    return payload["sub"]


# ============================================================================
# Global Assistant Settings
# ============================================================================

@APP_ROUTER.post("/App/whatsapp_config")
@limiter.limit("30/min")
async def update_whatsapp_config(request: Request, configs: Configs_type):
    """Save global assistant behaviour: language, role, memory, rules, style, task."""
    email = _email_from_cookie(request)

    user = await get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=401, detail="Account not found")

    ok = await Save_WhatsappConfig(user_id=user.id, email=email, config=configs.model_dump())
    if not ok:
        raise HTTPException(status_code=500, detail="Could not save config")
    return {"status": "saved"}


@APP_ROUTER.get("/App/whatsapp_config")
@limiter.limit("60/min")
async def get_whatsapp_config(request: Request):
    """Load the saved global behaviour."""
    email = _email_from_cookie(request)
    config = await Read_WhatsappConfig(email)
    return {"configured": config is not None, "config": config}


# ============================================================================
# Contacts & Number of Chats / Custom Per-Contact Personas
# ============================================================================

@APP_ROUTER.get("/App/contacts")
@limiter.limit("60/min")
async def get_contacts(request: Request, query: str = Query(default="")):
    """
    Returns contacts for the logged-in user with their number of chats,
    memory count, and whether custom settings (e.g. sarcastic tone) are active.
    Filters by phone number or contact name if query is supplied.
    """
    email = _email_from_cookie(request)
    contacts = await List_ContactsSummary(email)

    clean_q = query.strip().lower()
    if clean_q:
        contacts = [
            c for c in contacts
            if clean_q in c["whatsappNumber"].lower() or clean_q in (c.get("contactName") or "").lower()
        ]

    return {"contacts": contacts, "total": len(contacts)}


@APP_ROUTER.get("/App/contact_config")
@limiter.limit("60/min")
async def get_contact_config(request: Request, number: str = Query(...)):
    """
    Gets custom configuration for a specific WhatsApp phone number.
    Returns hasCustomConfig: false if the contact is using global defaults.
    """
    email = _email_from_cookie(request)
    cfg = await Read_ContactConfig(email, number)
    return {
        "whatsappNumber": number,
        "hasCustomConfig": cfg is not None and cfg.get("enabled", True),
        "config": cfg,
    }


@APP_ROUTER.post("/App/contact_config")
@limiter.limit("30/min")
async def update_contact_config(request: Request, payload: ContactConfigType):
    """
    Saves or updates custom persona / tone settings (e.g. sarcastic style, custom rules)
    for a specific WhatsApp number.
    """
    email = _email_from_cookie(request)
    user = await get_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=401, detail="Account not found")

    data = payload.model_dump(exclude_unset=False)
    ok = await Save_ContactConfig(
        user_id=user.id,
        email=email,
        whatsapp_number=payload.whatsappNumber,
        config=data,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Could not save contact configuration")
    return {"status": "saved", "whatsappNumber": payload.whatsappNumber}


@APP_ROUTER.delete("/App/contact_config")
@limiter.limit("30/min")
async def delete_contact_config(request: Request, number: str = Query(...)):
    """
    Deletes custom overrides for a WhatsApp number so it reverts to global settings.
    If number='all', deletes all custom configurations for the user.
    """
    email = _email_from_cookie(request)
    if number.strip().lower() == "all":
        count = await Delete_AllContactConfigs(email)
        return {"status": "all_reverted_to_global", "deletedCount": count, "success": True}

    ok = await Delete_ContactConfig(email, number)
    return {"status": "reverted_to_global", "whatsappNumber": number, "success": ok}


@APP_ROUTER.get("/App/contact_configs")
@limiter.limit("60/min")
async def list_contact_configs(request: Request):
    """
    Returns all custom contact configurations created by this user.
    """
    email = _email_from_cookie(request)
    configs = await List_ContactConfigs(email)
    return {"configs": configs, "total": len(configs)}


@APP_ROUTER.delete("/App/contact_configs/all")
@limiter.limit("20/min")
async def delete_all_contact_configs(request: Request):
    """
    Deletes all custom persona configurations for this user, reverting all contacts to global settings.
    """
    email = _email_from_cookie(request)
    count = await Delete_AllContactConfigs(email)
    return {
        "status": "all_reverted_to_global",
        "deletedCount": count,
        "message": f"Successfully reverted {count} contacts to global settings.",
    }


@APP_ROUTER.post("/App/contact_name")
@limiter.limit("45/min")
async def sync_contact_name(request: Request, payload: ContactNameSyncType):
    """
    Syncs or updates a contact's display name.
    Automatically detects relationship role (boss, love, friend, normal) and
    updates both chat stats and custom persona config.
    """
    email = _email_from_cookie(request)
    ok = await Update_ContactName(email, payload.whatsappNumber, payload.contactName)
    if not ok:
        raise HTTPException(status_code=500, detail="Could not update contact name")

    rel = detect_contact_relationship(payload.contactName)
    return {
        "status": "synced",
        "whatsappNumber": payload.whatsappNumber,
        "contactName": payload.contactName,
        "relationship": rel["category"],
        "relationshipLabel": rel["detected_label"],
        "success": True,
    }



# ============================================================================
# PgVector Memory Storage & Semantic Search Endpoints
# ============================================================================

@APP_ROUTER.get("/App/memories")
@limiter.limit("60/min")
async def get_memories(
    request: Request,
    number: str | None = Query(default=None),
    query: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
):
    """
    Fetches or semantically searches PgVector memories.
    If query is provided and number is provided, performs vector similarity search.
    Otherwise returns latest stored memories for the contact or user.
    """
    email = _email_from_cookie(request)

    if query and query.strip() and number and number.strip():
        q_emb = await generate_embedding(query.strip())
        memories = await Search_ChatMemories(
            email=email,
            whatsapp_number=number.strip(),
            query_embedding=q_emb,
            limit=limit,
        )
    else:
        memories = await List_ChatMemories(
            email=email,
            whatsapp_number=number.strip() if number else None,
            limit=limit,
        )

    return {"memories": memories, "count": len(memories)}


@APP_ROUTER.post("/App/memories")
@limiter.limit("30/min")
async def add_memory(request: Request, payload: MemoryCreateType):
    """
    Manually creates a new PgVector memory item with a 768-dim embedding
    for a specific contact number.
    """
    email = _email_from_cookie(request)
    embedding = await generate_embedding(payload.memoryText)

    ok = await Save_ChatMemory(
        email=email,
        whatsapp_number=payload.whatsappNumber,
        embedding=embedding,
        memory_text=payload.memoryText,
        sender_text=payload.memoryText,
        contact_text="Stored note",
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Could not store vector memory")
    return {"status": "saved", "memoryText": payload.memoryText}


@APP_ROUTER.delete("/App/memories/{memory_id}")
@limiter.limit("30/min")
async def delete_memory(request: Request, memory_id: int):
    """Deletes a specific PgVector memory by ID."""
    email = _email_from_cookie(request)
    ok = await Delete_ChatMemory(memory_id=memory_id, email=email)
    if not ok:
        raise HTTPException(status_code=404, detail="Memory not found or deletion failed")
    return {"status": "deleted", "id": memory_id}


# ============================================================================
# Automation Suite Overview Endpoint
# ============================================================================

@APP_ROUTER.get("/App/automations")
@limiter.limit("60/min")
async def get_automations_overview(request: Request):
    """
    Returns platform automation metrics: active channels, automated contacts,
    pgvector memory bank size, and enabled workflows.
    """
    email = _email_from_cookie(request)
    contacts = await List_ContactsSummary(email)
    memories = await List_ChatMemories(email, limit=1)

    custom_count = sum(1 for c in contacts if c.get("hasCustomConfig"))
    total_chats = sum(c.get("chatCount", 0) for c in contacts)

    return {
        "platform": "Web-Vector Automation Core",
        "channels": [
            {"id": "whatsapp", "name": "WhatsApp Engine", "status": "active", "type": "chat_automation"},
            {"id": "pgvector", "name": "PgVector Semantic Recall", "status": "active", "type": "memory_engine"},
            {"id": "webhooks", "name": "Event Triggers & Webhooks", "status": "ready", "type": "workflow"},
        ],
        "stats": {
            "totalContacts": len(contacts),
            "customPersonas": custom_count,
            "totalInteractions": total_chats,
            "vectorMemoryActive": True,
        }
    }
