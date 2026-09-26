// ============================================================================
// BaileysApi.ts
//
// THE ONLY Baileys file your Fastify routes should import.
// Fastify does not need to know about sockets, Mongo or message buffers.
// It only asks three simple questions:
//
//   getQrForUser(email)      "give me a QR so this user can link WhatsApp"
//   getStatusForUser(email)  "is this user's WhatsApp connected yet?"
//   disconnectUser(email)    "log this user out and delete the saved login"
//
// Who calls what:
//
//   Fastify route  ->  BaileysApi.ts  ->  CreateSession.ts  ->  Mongo / Baileys
//
// Typical frontend flow:
//   1. Frontend calls   GET  /whatsapp/qr      -> shows the QR
//   2. User scans the QR on the phone
//   3. Frontend polls   GET  /whatsapp/status  -> until state is "open"
//   4. Later, "disconnect" button calls  DELETE /whatsapp
// ============================================================================

import { waitForQrCode, getSession, logoutSession } from "./CreateSession.ts";
import type { QrResult, SessionStatus } from "./BaileysTypes.ts";





// ============================================================================
// SECTION 1: GET QR
// ============================================================================

// Starts the session if needed and waits for the QR.
// Returns { status: "qr", qr } or { status: "connected" } if the user is already linked.
// If Baileys gives no QR within 30 seconds, this throws an error (Fastify turns it into a 500).
export async function getQrForUser(email: string): Promise<QrResult> {
  const qr = await waitForQrCode(email);
  console.log(qr)

  if (qr === null) return { status: "connected" };
  

  return { status: "qr", qr };
}





// ============================================================================
// SECTION 2: STATUS
// ============================================================================

// Never starts anything. Only reports what is happening right now.
// state: "not_started" | "connecting" | "qr" | "open" | "closed"
export function getStatusForUser(email: string): SessionStatus {
  const session = getSession(email);

  if (!session) return { state: "not_started", whatsappNumber: null };

  return { state: session.state, whatsappNumber: session.whatsappNumber };
}





// ============================================================================
// SECTION 3: DISCONNECT (LOGOUT + DELETE)
// ============================================================================

// Closes WhatsApp, removes the session from memory and deletes the saved login from Mongo.
// The next getQrForUser() will start fresh and show a new QR.
export async function disconnectUser(email: string) {
  await logoutSession(email);

  return { status: "disconnected" };
}
