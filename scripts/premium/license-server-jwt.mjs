/**
 * Ed25519 JWT signing helpers for the Qadbak license server.
 *
 * Replace your HS256 sign call with `signLicenseToken(payload)` and the
 * customer panel (which now ships with config/license-public.pem) will
 * verify tokens locally without ever needing a shared secret.
 *
 * Env vars on the license server:
 *
 *   QADBAK_LICENSE_SIGNING_KEY       PEM file with the Ed25519 private key
 *   QADBAK_LICENSE_HS256_SECRET      (optional) keep HS256 issuance during
 *                                    the transition; remove once all
 *                                    customer panels have updated.
 *
 * Tokens carry the customer's plan, features, expiresAt, instanceId, etc.
 * — same payload as before; only the algorithm changes.
 *
 * Drop into your license server's `lib/jwt.mjs` (or equivalent) and call:
 *
 *   import { signLicenseToken } from "./license-server-jwt.mjs";
 *   const token = await signLicenseToken({
 *     sub: customerEmail,
 *     plan: "pro",
 *     features: ["admin-updates", ...],
 *     instanceId,
 *     artifactVersion: "0.1.0",
 *     expiresAt: "2027-01-01T00:00:00Z",
 *   });
 *
 * Returns a JWT string compatible with the customer panel's
 * verifyLicenseToken (alg=EdDSA, header.typ=JWT).
 */

import { readFile } from "node:fs/promises";
import { SignJWT, importPKCS8 } from "jose";

let cachedPrivKey = null;
let cachedPrivKeyPath = null;

async function loadPrivateKey() {
  const keyPath = process.env.QADBAK_LICENSE_SIGNING_KEY?.trim();
  if (!keyPath) {
    throw new Error(
      "QADBAK_LICENSE_SIGNING_KEY env var (path to Ed25519 PEM) is required.",
    );
  }
  if (cachedPrivKey && cachedPrivKeyPath === keyPath) return cachedPrivKey;
  const pem = await readFile(keyPath, "utf8");
  cachedPrivKey = await importPKCS8(pem, "EdDSA");
  cachedPrivKeyPath = keyPath;
  return cachedPrivKey;
}

/**
 * Sign a Qadbak license token with Ed25519.
 *
 * @param {object} payload - the JWT claims; common Qadbak fields:
 *   - plan, status, features, expiresAt, instanceId, artifactVersion
 * @param {object} opts
 * @param {string} [opts.issuer="qadbak-license-server"]
 * @param {string} [opts.audience="qadbak-panel"]
 * @param {string} [opts.expiresIn="365d"] — JWT-level expiry (separate from
 *                                            the human-readable expiresAt
 *                                            claim used for UI display).
 */
export async function signLicenseToken(payload, opts = {}) {
  const key = await loadPrivateKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(opts.issuer ?? "qadbak-license-server")
    .setAudience(opts.audience ?? "qadbak-panel")
    .setExpirationTime(opts.expiresIn ?? "365d")
    .sign(key);
}

/**
 * Optional: legacy HS256 signer for the transition period. Remove once
 * all customer panels carry config/license-public.pem.
 *
 * Customer panels with no Ed25519 public key but a configured
 * QADBAK_LICENSE_JWT_SECRET will still verify these tokens.
 */
export async function signLegacyHs256Token(payload, opts = {}) {
  const secret = process.env.QADBAK_LICENSE_HS256_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "QADBAK_LICENSE_HS256_SECRET (>=16 chars) required for legacy HS256 issuance.",
    );
  }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(opts.issuer ?? "qadbak-license-server")
    .setAudience(opts.audience ?? "qadbak-panel")
    .setExpirationTime(opts.expiresIn ?? "365d")
    .sign(new TextEncoder().encode(secret));
}

/**
 * Issue both Ed25519 and HS256 tokens during the transition window.
 * Use this if some customer panels haven't updated yet — the activate/
 * heartbeat endpoint can return the Ed25519 token by default, and serve
 * the HS256 token to panels that explicitly request it via an Accept
 * header or query param.
 */
export async function signLicenseTokenDual(payload, opts = {}) {
  const [ed25519, hs256] = await Promise.all([
    signLicenseToken(payload, opts),
    signLegacyHs256Token(payload, opts).catch(() => null),
  ]);
  return { ed25519, hs256 };
}
