import "server-only";
import http2 from "node:http2";
import { readFile } from "node:fs/promises";
import { SignJWT, importPKCS8 } from "jose";

export type ApnsAlertPayload = {
  title: string;
  body: string;
  category?: string;
  data?: Record<string, string>;
};

let cachedAuth: { token: string; expiresAt: number } | null = null;
let cachedKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;

export function apnsConfigured(): boolean {
  return Boolean(
    process.env.QADBAK_APNS_KEY_ID?.trim() &&
      process.env.QADBAK_APNS_TEAM_ID?.trim() &&
      (process.env.QADBAK_APNS_KEY_PATH?.trim() ||
        process.env.QADBAK_APNS_KEY_P8?.trim()),
  );
}

async function loadSigningKey() {
  if (cachedKey) return cachedKey;
  const inline = process.env.QADBAK_APNS_KEY_P8?.trim();
  const pem = inline
    ? inline.replace(/\\n/g, "\n")
    : await readFile(process.env.QADBAK_APNS_KEY_PATH!.trim(), "utf8");
  cachedKey = await importPKCS8(pem, "ES256");
  return cachedKey;
}

async function apnsAuthToken(): Promise<string> {
  const now = Date.now();
  if (cachedAuth && cachedAuth.expiresAt > now + 60_000) {
    return cachedAuth.token;
  }
  const key = await loadSigningKey();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.QADBAK_APNS_KEY_ID!.trim() })
    .setIssuer(process.env.QADBAK_APNS_TEAM_ID!.trim())
    .setIssuedAt()
    .setExpirationTime("50m")
    .sign(key);
  cachedAuth = { token, expiresAt: now + 50 * 60 * 1000 };
  return token;
}

function apnsHost(): string {
  return process.env.QADBAK_APNS_SANDBOX === "true"
    ? "api.sandbox.push.apple.com"
    : "api.push.apple.com";
}

function defaultBundleId(): string {
  return process.env.QADBAK_APNS_BUNDLE_ID?.trim() || "com.qadbak.panel";
}

export async function sendApnsNotification(
  deviceToken: string,
  payload: ApnsAlertPayload,
  bundleId = defaultBundleId(),
): Promise<boolean> {
  if (!apnsConfigured()) return false;
  const token = deviceToken.replace(/\s+/g, "").toLowerCase();
  if (!/^[a-f0-9]{32,}$/.test(token)) return false;

  const auth = await apnsAuthToken();
  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      ...(payload.category ? { category: payload.category } : {}),
    },
    ...payload.data,
  });

  return new Promise((resolve) => {
    const client = http2.connect(`https://${apnsHost()}`);
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${auth}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });
    let status = 0;
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("end", () => {
      client.close();
      resolve(status === 200);
    });
    req.on("error", () => {
      client.close();
      resolve(false);
    });
    req.end(body);
  });
}
