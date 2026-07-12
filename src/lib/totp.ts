import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31]!;
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31]!;
  return out;
}

function base32Decode(input: string): Buffer {
  let clean = "";
  for (const ch of input) {
    if (ch === "=") break;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") continue;
    clean += ch.toUpperCase();
  }
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function verifyTotpCode(secretBase32: string, token: string): boolean {
  const code = token.replace(/\s/g, "");
  if (!/^\d{6,8}$/.test(code)) return false;
  const secret = base32Decode(secretBase32);
  if (secret.length < 10) return false;
  const step = Math.floor(Date.now() / 1000 / 30);
  for (let w = -1; w <= 1; w++) {
    const expected = hotp(secret, step + w);
    const a = Buffer.from(expected);
    const b = Buffer.from(code.slice(0, 6).padStart(6, "0"));
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function totpOtpauthUrl(
  username: string,
  secret: string,
  issuer = "Qadbak",
): string {
  const label = encodeURIComponent(`${issuer}:${username}`);
  const q = new URLSearchParams({
    secret: secret.replace(/\s/g, ""),
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}
