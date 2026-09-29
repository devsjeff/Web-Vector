// ============================================================================
// whatsappRoutes.ts
//
//   GET    /whatsapp/qr       start (or reuse) the user's session and return a QR to scan
//   GET    /whatsapp/status   what is the connection doing right now (the dashboard polls this)
//   DELETE /whatsapp/logout   unlink WhatsApp and delete the saved login
//
// All three need the login cookie that Python (FastAPI) set. The `requireUser` hook below reads it,
// verifies the JWT and puts the user's email on `request.userEmail`, so no route repeats that code.
// ============================================================================

import type { FastifyPluginAsync } from "fastify";
import "@fastify/cookie";
import "@fastify/sensible";
import VerifyJwt from "../../../Auth/JwtGeneral.ts";
import { disconnectUser, getQrForUser, getStatusForUser } from "../../../Baileys/BaileysApi.ts";

declare module "fastify" {
  interface FastifyRequest {
    userEmail: string;
  }
}

export const WhatsappRoutes: FastifyPluginAsync = async (app) => {
  app.decorateRequest("userEmail", "");

  // Runs before every route in this file.
  app.addHook("preHandler", async (request, reply) => {
    const token = request.cookies.access_token;
    if (!token) return reply.unauthorized("Not logged in");

    const auth = await VerifyJwt(token);
    if (!auth.result) return reply.unauthorized("Invalid or expired login");

    request.userEmail = auth.email;
  });

  // The frontend refreshes the QR about every 16s, so this needs more room than the global 5 per minute.
  app.get("/whatsapp/qr", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request) => getQrForUser(request.userEmail));

  // The dashboard polls this every 2s while a QR is showing.
  app.get("/whatsapp/status", { config: { rateLimit: { max: 90, timeWindow: "1 minute" } } }, async (request) => getStatusForUser(request.userEmail));

  app.delete("/whatsapp/logout", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => disconnectUser(request.userEmail));
};
