import { NextResponse } from "next/server";
import {
  INTERNAL_SESSION_REVOCATION_HEADER,
  internalRequestAuthorized,
} from "@/lib/internal-api-auth";
import { sessionRevokedSync } from "@/lib/session-revocation-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Internal-only: session revocation lookup for middleware (Edge fallback). */
export async function POST(request: Request) {
  if (!internalRequestAuthorized(request.headers.get(INTERNAL_SESSION_REVOCATION_HEADER))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  let body: { jti?: string; userId?: string; iat?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ error: "userId required." }, { status: 400 });
  }
  const jti = body.jti ? String(body.jti) : undefined;
  const iat =
    typeof body.iat === "number" && Number.isFinite(body.iat)
      ? body.iat
      : Math.floor(Date.now() / 1000);
  const revoked = sessionRevokedSync(jti, userId, iat);
  return NextResponse.json({ revoked });
}
