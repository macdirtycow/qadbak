import { SignJWT } from "jose";
import type { SessionPayload } from "./types";
import { assertDemoTerminalAllowed } from "./demo-mode";

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
  assertDemoTerminalAllowed(session.username);
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

/** Admin-only root shell (Server admin → Terminal). */
export async function createAdminTerminalWsToken(
  session: SessionPayload,
): Promise<string> {
  if (session.role !== "admin") {
    throw new Error("Only administrators may use the server terminal.");
  }
  assertDemoTerminalAllowed(session.username);
  return new SignJWT({
    purpose: "admin-terminal-ws",
    sub: session.userId,
    username: session.username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("120s")
    .sign(secretKey());
}

/** Subprotocol label — JWT is sent as the second protocol (not in the URL). */
export const TERMINAL_WS_PROTOCOL = "qadbak-terminal";

/** Build WebSocket URL (no credentials in query string — use TERMINAL_WS_PROTOCOL + token). */
export function terminalWsUrl(request: Request): string {
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
  const path = reqUrl.pathname.includes("admin")
    ? "/ws/admin-terminal"
    : "/ws/domain-terminal";
  return `${wsProto}://${host}${path}`;
}

export function terminalWsProtocols(token: string): string[] {
  return [TERMINAL_WS_PROTOCOL, token];
}

export function terminalAvailable(): boolean {
  if (process.env.QADBAK_NATIVE_TERMINAL === "false") return false;
  if (process.env.QADBAK_LEGACY_API_MOCK === "true") return true;
  return process.env.QADBAK_TERMINAL_WS_PORT !== "off";
}

function terminalWsPort(): number {
  const raw = process.env.QADBAK_TERMINAL_WS_PORT || "3001";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 3001;
}

/** True when the pm2 qadbak-terminal process is listening (HTTP 426 on /). */
export async function terminalBackendReady(): Promise<boolean> {
  if (!terminalAvailable()) return false;
  if (process.env.QADBAK_LEGACY_API_MOCK === "true") return true;
  const host = process.env.QADBAK_TERMINAL_WS_HOST || "127.0.0.1";
  const port = terminalWsPort();
  try {
    const res = await fetch(`http://${host}:${port}/`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.status === 426;
  } catch {
    return false;
  }
}

export const TERMINAL_SETUP_HINT =
  "On the server run: sudo bash scripts/apply-terminal-native.sh";
