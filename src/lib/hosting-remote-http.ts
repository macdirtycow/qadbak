import http from "node:http";
import https from "node:https";
import {
  legacyApiHttpsAgent,
  legacyApiTlsInsecureEnabled,
  resolveLegacyApiUrl,
} from "./legacy-api-tls";

export { legacyApiTlsInsecureEnabled } from "./legacy-api-tls";

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

/** POST to remote.cgi — strict TLS by default; localhost may use HTTP or pinned HTTPS. */
export async function hostingRemoteFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const resolvedUrl = resolveLegacyApiUrl(url);
  const target = new URL(resolvedUrl);

  if (target.protocol === "http:") {
    return nodeRequest(http, resolvedUrl, init);
  }

  const agent = legacyApiHttpsAgent();
  if (agent) {
    return nodeRequest(https, resolvedUrl, init, agent);
  }

  return fetch(resolvedUrl, init);
}
