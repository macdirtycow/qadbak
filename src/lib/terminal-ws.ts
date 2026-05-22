import { SignJWT } from "jose";
import type { SessionPayload } from "./types";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short.");
  }
  return new TextEncoder().encode(secret);
}

export async function createTerminalWsToken(
  domain: string,
  unixUser: string,
  session: SessionPayload,
): Promise<string> {
  return new SignJWT({
    purpose: "terminal-ws",
    domain,
    unixUser,
    sub: session.userId,
    username: session.username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("120s")
    .sign(secretKey());
}

/** Build WebSocket URL from the incoming API request (prefer client-side builder in browser). */
export function terminalWsUrl(request: Request, token: string): string {
  const reqUrl = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    reqUrl.host;
  const forwarded = request.headers.get("x-forwarded-proto");
  const proto =
    forwarded ??
    (reqUrl.protocol === "https:" ? "https" : "http");
  const wsProto = proto === "https" ? "wss" : "ws";
  const q = new URLSearchParams({ token });
  return `${wsProto}://${host}/ws/domain-terminal?${q.toString()}`;
}

export function terminalAvailable(): boolean {
  if (process.env.QADBAK_NATIVE_TERMINAL === "false") return false;
  if (process.env.VIRTUALMIN_MOCK === "true") return true;
  return process.env.QADBAK_TERMINAL_WS_PORT !== "off";
}
