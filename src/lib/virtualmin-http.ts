import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";

function virtualMinUrlIsLocal(): boolean {
  const url = process.env.VIRTUALMIN_URL?.trim();
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

/**
 * When true, VirtualMin fetch skips TLS verification (localhost self-signed Webmin only).
 * Auto-enabled for VIRTUALMIN_URL on 127.0.0.1/localhost unless VIRTUALMIN_TLS_INSECURE=false.
 */
export function virtualMinTlsInsecureEnabled(): boolean {
  const flag = process.env.VIRTUALMIN_TLS_INSECURE?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "yes") return true;

  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    console.warn(
      "[qadbak] NODE_TLS_REJECT_UNAUTHORIZED=0 affects all HTTPS from this process. " +
        "Prefer VIRTUALMIN_TLS_INSECURE=true in .env.local (VirtualMin API only).",
    );
    return true;
  }

  return virtualMinUrlIsLocal();
}

const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

function requestBody(init: RequestInit): string | undefined {
  if (typeof init.body === "string") return init.body;
  if (init.body instanceof URLSearchParams) return init.body.toString();
  if (init.body) return String(init.body);
  return undefined;
}

function nodeRequest(
  mod: typeof http | typeof https,
  url: string,
  init: RequestInit,
  agent?: https.Agent,
): Promise<Response> {
  const target = new URL(url);
  const body = requestBody(init);

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: init.method ?? "GET",
        headers: headersToRecord(init.headers),
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) responseHeaders.append(key, v);
            } else {
              responseHeaders.set(key, value);
            }
          }
          resolve(
            new Response(Readable.toWeb(Readable.from(buf)) as ReadableStream<Uint8Array>, {
              status: res.statusCode ?? 500,
              headers: responseHeaders,
            }),
          );
        });
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/** POST to remote.cgi — strict TLS by default; opt-in insecure for localhost self-signed. */
export async function virtualMinFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const target = new URL(url);
  const insecure = virtualMinTlsInsecureEnabled();

  if (!insecure) {
    return fetch(url, init);
  }

  if (target.protocol === "http:") {
    return nodeRequest(http, url, init);
  }
  return nodeRequest(https, url, init, insecureHttpsAgent);
}
