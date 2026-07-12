/** Runtime security knobs (readable from Edge and Node). */

export function sessionSecretMinLength(): number {
  const raw = Number(process.env.QADBAK_SESSION_SECRET_MIN_LENGTH ?? "32");
  return Number.isFinite(raw) && raw >= 16 ? raw : 32;
}

export function requireAdminTotp(): boolean {
  const v = process.env.QADBAK_REQUIRE_ADMIN_TOTP?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function healthMinimalPublic(): boolean {
  const v = process.env.QADBAK_HEALTH_MINIMAL?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  if (v === "true" || v === "1" || v === "yes") return true;
  return process.env.NODE_ENV === "production";
}

export function trustProxyHeaders(): boolean {
  const v = process.env.QADBAK_TRUST_PROXY?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return (
    v === "true" ||
    v === "1" ||
    v === "yes" ||
    process.env.NODE_ENV === "production"
  );
}

export function sessionMaxAgeSec(): number {
  const hours = Number(process.env.QADBAK_SESSION_MAX_AGE_HOURS ?? "168");
  if (!Number.isFinite(hours) || hours < 1) return 60 * 60 * 24 * 7;
  return Math.min(hours, 24 * 30) * 60 * 60;
}

export function sessionSameSite(): "lax" | "strict" | "none" {
  const v = process.env.QADBAK_COOKIE_SAMESITE?.trim().toLowerCase();
  if (v === "strict" || v === "none" || v === "lax") return v;
  return "strict";
}
