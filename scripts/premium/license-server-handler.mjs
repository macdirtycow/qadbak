/**
 * Drop-in license-server handler that streams Premium artifacts from a
 * private GitHub repo's Releases page, on behalf of an authenticated
 * customer panel.
 *
 * Mount this on your license server (license.omiiba.dev) at:
 *
 *   GET /v1/artifacts/:version/premium.tar.gz?token=<jwt>
 *   GET /v1/artifacts/:version/premium.tar.gz.sig?token=<jwt>
 *
 * The panel side (src/lib/premium/loader.ts) hits exactly that URL.
 *
 * What it does:
 *   1. Validates the JWT token using QADBAK_LICENSE_JWT_SECRET (HS256).
 *   2. Optionally checks that the version requested is one this licence
 *      was issued for (token.payload.artifactVersion).
 *   3. Looks up release "v<version>" on $QADBAK_PREMIUM_REPO via the
 *      GitHub API (using $GITHUB_TOKEN with `repo` scope).
 *   4. Streams the corresponding asset (premium-<version>.tar.gz or
 *      .sig) straight to the client. No caching on disk — the GH CDN
 *      handles that.
 *
 * Required env on the license server:
 *   QADBAK_LICENSE_JWT_SECRET   HS256 secret used to sign customer JWTs
 *   QADBAK_PREMIUM_REPO         e.g. macdirtycow/qadbak-premium-artifacts
 *   GITHUB_TOKEN                PAT with `contents:read` on the repo
 *
 * Optional:
 *   QADBAK_ARTIFACT_USER_AGENT  default "qadbak-license-server"
 *
 * Adapters provided below:
 *   - registerExpress(app)    — Express 4/5
 *   - createNextRouteHandler  — Next.js App Router (export from app/api/v1/artifacts/[version]/[file]/route.js)
 *   - createNodeHandler       — bare http.Server fallback
 *
 * Example (Express):
 *
 *   import express from "express";
 *   import { registerExpress } from "./license-server-handler.mjs";
 *   const app = express();
 *   registerExpress(app);
 *   app.listen(8787);
 */

import { jwtVerify } from "jose";

const UA = process.env.QADBAK_ARTIFACT_USER_AGENT || "qadbak-license-server";

const ALLOWED_FILES = new Set(["premium.tar.gz", "premium.tar.gz.sig"]);

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} env var is required for the artifact handler.`);
  return v;
}

function jwtSecret() {
  return new TextEncoder().encode(requireEnv("QADBAK_LICENSE_JWT_SECRET"));
}

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), {
      algorithms: ["HS256"],
    });
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Resolve a release asset URL on GitHub.
 *  - version = "0.1.0" → tag "v0.1.0"
 *  - asset name = "premium-0.1.0.tar.gz" or "premium-0.1.0.tar.gz.sig"
 */
async function resolveReleaseAsset(version, file) {
  const repo = requireEnv("QADBAK_PREMIUM_REPO");
  const ghToken = requireEnv("GITHUB_TOKEN");
  const tag = `v${version}`;
  const assetName =
    file === "premium.tar.gz"
      ? `premium-${version}.tar.gz`
      : `premium-${version}.tar.gz.sig`;
  const releaseRes = await fetch(
    `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": UA,
      },
    },
  );
  if (releaseRes.status === 404) {
    return { error: { status: 404, message: `Release ${tag} not found on ${repo}` } };
  }
  if (!releaseRes.ok) {
    return {
      error: {
        status: 502,
        message: `GitHub release lookup failed (${releaseRes.status})`,
      },
    };
  }
  const release = await releaseRes.json();
  const asset = (release.assets || []).find((a) => a.name === assetName);
  if (!asset) {
    return {
      error: {
        status: 404,
        message: `Asset ${assetName} not found on release ${tag}`,
      },
    };
  }
  return { asset, repo, ghToken, assetName };
}

async function streamAsset({ asset, ghToken, contentType }, writeHead, writeBody) {
  // GH releases assets are served from a redirector; use Accept:
  // application/octet-stream to get the raw bytes via the API.
  const ghStream = await fetch(asset.url, {
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: "application/octet-stream",
      "User-Agent": UA,
    },
    redirect: "follow",
  });
  if (!ghStream.ok || !ghStream.body) {
    writeHead(502, {
      "content-type": "application/json",
    });
    writeBody(
      Buffer.from(
        JSON.stringify({
          error: `GitHub asset stream failed (${ghStream.status})`,
        }),
      ),
    );
    return;
  }
  const headers = {
    "content-type": contentType,
    "content-length": ghStream.headers.get("content-length") ?? asset.size,
    "x-qadbak-source": "github-releases",
    "x-qadbak-asset": asset.name,
    "cache-control": "private, no-store",
  };
  writeHead(200, headers);
  const reader = ghStream.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    writeBody(Buffer.from(value));
  }
}

/** Core handler returning a normalized result object. Adapters wrap it. */
export async function handleArtifactRequest({ version, file, token }) {
  if (!version || !/^[A-Za-z0-9._-]{1,40}$/.test(version)) {
    return { status: 400, body: { error: "Invalid version" } };
  }
  if (!ALLOWED_FILES.has(file)) {
    return { status: 400, body: { error: "Invalid file" } };
  }
  if (!token) {
    return { status: 401, body: { error: "Missing token" } };
  }
  const v = await verifyToken(token);
  if (!v.valid) {
    return { status: 401, body: { error: `Invalid token: ${v.error}` } };
  }
  // Optional: enforce that the token's artifactVersion matches the
  // requested version. This stops a customer with v0.1 entitlement from
  // pulling a v0.2 build the moment you publish it.
  const tokenVersion = v.payload?.artifactVersion;
  if (tokenVersion && tokenVersion !== version) {
    return {
      status: 403,
      body: {
        error: `Token entitled to version ${tokenVersion}, requested ${version}.`,
      },
    };
  }
  const resolved = await resolveReleaseAsset(version, file);
  if (resolved.error) {
    return { status: resolved.error.status, body: { error: resolved.error.message } };
  }
  const contentType = file.endsWith(".sig")
    ? "application/pgp-signature"
    : "application/gzip";
  return { stream: true, resolved, contentType };
}

/* ───────────────────── Express adapter ───────────────────── */

export function registerExpress(app) {
  app.get("/v1/artifacts/:version/:file", async (req, res) => {
    try {
      const result = await handleArtifactRequest({
        version: req.params.version,
        file: req.params.file,
        token:
          typeof req.query.token === "string" ? req.query.token : undefined,
      });
      if (!result.stream) {
        res.status(result.status).type("application/json").send(result.body);
        return;
      }
      await streamAsset(
        { ...result.resolved, contentType: result.contentType },
        (code, headers) => {
          res.status(code);
          for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
        },
        (chunk) => res.write(chunk),
      );
      res.end();
    } catch (e) {
      res.status(500).json({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}

/* ───────────── Next.js App Router adapter ───────────── */

export function createNextRouteHandler() {
  return async function GET(req, ctx) {
    const { version, file } = (await ctx.params) || ctx.params;
    const token = new URL(req.url).searchParams.get("token");
    const result = await handleArtifactRequest({ version, file, token });
    if (!result.stream) {
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { "content-type": "application/json" },
      });
    }
    const { resolved, contentType } = result;
    const ghStream = await fetch(resolved.asset.url, {
      headers: {
        Authorization: `Bearer ${resolved.ghToken}`,
        Accept: "application/octet-stream",
        "User-Agent": UA,
      },
      redirect: "follow",
    });
    return new Response(ghStream.body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "content-length":
          ghStream.headers.get("content-length") ?? String(resolved.asset.size),
        "x-qadbak-source": "github-releases",
        "x-qadbak-asset": resolved.asset.name,
        "cache-control": "private, no-store",
      },
    });
  };
}

/* ───────────── Bare http.Server fallback ───────────── */

export function createNodeHandler() {
  return async function handle(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const m = url.pathname.match(/^\/v1\/artifacts\/([^/]+)\/([^/]+)$/);
      if (!m) {
        res.writeHead(404).end();
        return;
      }
      const result = await handleArtifactRequest({
        version: decodeURIComponent(m[1]),
        file: decodeURIComponent(m[2]),
        token: url.searchParams.get("token") ?? undefined,
      });
      if (!result.stream) {
        res.writeHead(result.status, {
          "content-type": "application/json",
        });
        res.end(JSON.stringify(result.body));
        return;
      }
      await streamAsset(
        { ...result.resolved, contentType: result.contentType },
        (code, headers) => res.writeHead(code, headers),
        (chunk) => res.write(chunk),
      );
      res.end();
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      );
    }
  };
}
