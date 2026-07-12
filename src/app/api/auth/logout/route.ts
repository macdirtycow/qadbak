import { clearAllSessionCookies } from "@/lib/session";
import { NextResponse } from "next/server";

/** Public - must clear cookies even when the JWT is expired. */
export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  return clearAllSessionCookies(response, request);
}
