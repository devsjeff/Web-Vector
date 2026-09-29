// ============================================================================
// JwtGeneral.ts
//
// Python (FastAPI) signs the login cookie (HS256, `sub` = user's email).
// Node only VERIFIES it here, with the SAME JWT_SECRET from Backend/.env.
// ============================================================================

import { jwtVerify } from "jose";
import { env } from "../CommonENV.ts";

const JWT_SECRET = new TextEncoder().encode(env.JWT_SECRET);

export default async function Verify_JWT_Token(token: string): Promise<{ result: true; email: string } | { result: false }> {
  try {
    // Only accept HS256, the exact algorithm Python uses.
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });

    if (typeof payload.sub !== "string" || payload.sub === "") return { result: false };

    return { result: true, email: payload.sub };
  } catch {
    return { result: false };
  }
}
