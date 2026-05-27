import { apiPath } from "@/lib/install-salt";

/** Build a panel API URL (respects per-install `/api/x/<salt>` prefix). */
export function domainApiPath(domain: string, subpath: string): string {
  const enc = encodeURIComponent(domain);
  const p = subpath.startsWith("/") ? subpath : `/${subpath}`;
  return apiPath(`/domains/${enc}${p}`);
}

export async function parseApiJson<T extends { error?: string }>(
  res: Response,
): Promise<T> {
  const raw = await res.text();
  if (!raw.trim()) {
    if (!res.ok) {
      throw new Error(res.statusText || `Request failed (${res.status})`);
    }
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    const preview = raw.replace(/\s+/g, " ").slice(0, 160);
    const html = raw.trimStart().startsWith("<!");
    throw new Error(
      res.ok
        ? "Invalid server response."
        : html
          ? `Request failed (${res.status}): server returned HTML — run update-qadbak.sh on the panel or check pm2 logs.`
          : `Request failed (${res.status}): ${preview || res.statusText}`,
    );
  }
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(apiPath(path), {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers,
  });
}

export function domainApiFetch(
  domain: string,
  subpath: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(domainApiPath(domain, subpath), {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers,
  });
}
