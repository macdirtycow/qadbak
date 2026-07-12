import http from "node:http";
import https from "node:https";

function legacyApiUrlIsLocal(urlString?: string): boolean {
  const url = urlString?.trim() || process.env.QADBAK_LEGACY_API_URL?.trim();
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

/**
 * When true, legacy hosting API fetch skips TLS verification (localhost self-signed server admin only).
 * Auto-enabled for QADBAK_LEGACY_API_URL on 127.0.0.1/localhost unless QADBAK_LEGACY_API_TLS_INSECURE=false.
 */
export function legacyApiTlsInsecureEnabled(): boolean {
  const flag = process.env.QADBAK_LEGACY_API_TLS_INSECURE?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "yes") return true;

  return legacyApiUrlIsLocal();
}

function localhostInsecureAgent(target: URL): https.Agent {
  if (!legacyApiUrlIsLocal(target.href)) {
    throw new Error("Insecure TLS is only allowed for localhost legacy API URLs.");
  }
  // lgtm[js/disabling-certificate-validation] localhost self-signed legacy API only
  return new https.Agent({ rejectUnauthorized: false });
}

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
  const headers = headersToRecord(init.headers);
  if (body) {
    headers["Content-Length"] = String(Buffer.byteLength(body, "utf8"));
  }

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        method: init.method ?? "GET",
        headers,
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
            new Response(new Uint8Array(buf), {
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
export async function hostingRemoteFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const target = new URL(url);
  const insecure = legacyApiTlsInsecureEnabled();

  if (!insecure) {
    return fetch(url, init);
  }

  if (target.protocol === "http:") {
    return nodeRequest(http, url, init);
  }
  return nodeRequest(https, url, init, localhostInsecureAgent(target));
}
