import https from "node:https";
import { Readable } from "node:stream";

/**
 * When true, VirtualMin fetch uses a dedicated HTTPS agent instead of
 * NODE_TLS_REJECT_UNAUTHORIZED=0 (which disables TLS verification process-wide).
 */
export function virtualMinTlsInsecureEnabled(): boolean {
  const flag = process.env.VIRTUALMIN_TLS_INSECURE?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;

  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    console.warn(
      "[qadbak] NODE_TLS_REJECT_UNAUTHORIZED=0 affects all HTTPS from this process. " +
        "Prefer VIRTUALMIN_TLS_INSECURE=true in .env.local (VirtualMin API only).",
    );
    return true;
  }
  return false;
}

const insecureAgent = new https.Agent({ rejectUnauthorized: false });

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

/** POST to remote.cgi with optional self-signed TLS (localhost Webmin only). */
function virtualMinFetchInsecure(url: string, init: RequestInit): Promise<Response> {
  const target = new URL(url);
  const body =
    typeof init.body === "string"
      ? init.body
      : init.body instanceof URLSearchParams
        ? init.body.toString()
        : init.body
          ? String(init.body)
          : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: init.method ?? "GET",
        headers: headersToRecord(init.headers),
        agent: insecureAgent,
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

export async function virtualMinFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  if (!virtualMinTlsInsecureEnabled()) {
    return fetch(url, init);
  }
  return virtualMinFetchInsecure(url, init);
}
