/**
 * Sanitize captured commands, file paths and outputs before persisting them
 * to the journal. We never want passwords, license keys, JWT secrets, API
 * tokens or session cookies on disk in `data/journal/*.jsonl`.
 *
 * This is a redaction pass with conservative defaults — false positives are
 * fine (we replace a secret with "***"), false negatives are not.
 */

const PATTERNS: { re: RegExp; replace: string }[] = [
  // shell-style: PASSWORD='abc', SECRET="xyz", API_KEY=plain
  {
    re: /\b([A-Z][A-Z0-9_]*(?:PASS(?:WORD)?|SECRET|TOKEN|KEY|JWT|CREDENTIALS|COOKIE)[A-Z0-9_]*)=(?:"[^"]*"|'[^']*'|\S+)/g,
    replace: '$1=***',
  },
  // CLI flags: --password=abc, --pass abc, -p abc, --token=...
  {
    re: /(--?(?:password|pass|secret|token|key|api[-_]?key|credentials|jwt)(?:=|\s+))(?:"[^"]*"|'[^']*'|\S+)/gi,
    replace: '$1***',
  },
  // Stripe keys
  { re: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g, replace: 'sk_***' },
  { re: /\bpk_(?:live|test)_[A-Za-z0-9]{16,}\b/g, replace: 'pk_***' },
  { re: /\brk_(?:live|test)_[A-Za-z0-9]{16,}\b/g, replace: 'rk_***' },
  // GitHub-style tokens
  { re: /\bgh[psuro]_[A-Za-z0-9]{20,}\b/g, replace: 'gh_***' },
  // Bearer tokens in headers / Authorization
  {
    re: /\b([Aa]uthorization:?\s*[Bb]earer\s+)([A-Za-z0-9._\-]+)/g,
    replace: '$1***',
  },
  // Long base64 sequences in env-style assignments (likely a secret)
  {
    re: /\b((?:SESSION_SECRET|JWT_SECRET|KEY_VAULT_SECRET|LICENSE_JWT_SECRET))(\s*[:=]\s*)([A-Za-z0-9+/=._\-]{20,})/g,
    replace: '$1$2***',
  },
  // Qadbak license keys (QAD-XXXX-XXXX-XXXX or longer hashed forms)
  { re: /\bQAD-[A-Za-z0-9]{4,}(?:-[A-Za-z0-9]{4,}){1,}/g, replace: 'QAD-***' },
  // Bcrypt hashes
  { re: /\$2[aby]?\$[0-9]{2}\$[./A-Za-z0-9]{50,}/g, replace: '$2a$**$***' },
  // Inline TLS private key blocks (just in case)
  {
    re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
    replace: '-----PRIVATE-KEY-REDACTED-----',
  },
];

/** Apply all redaction patterns to a string. */
export function sanitize(value: string): string {
  let out = value;
  for (const { re, replace } of PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

/** Truncate output to a maximum byte length (UTF-8 safe-ish). */
export function truncate(value: string, maxBytes = 4096): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  // Cut at character boundary; not exact on multi-byte but safe.
  const cut = value.slice(0, maxBytes);
  return `${cut}\n…[${Buffer.byteLength(value, "utf8") - maxBytes} bytes truncated]`;
}

/** Convenience: sanitize then truncate. */
export function sanitizeOutput(value: string, maxBytes = 4096): string {
  return truncate(sanitize(value), maxBytes);
}

/** Sanitize a free-form metadata object (1 level deep). */
export function sanitizeMetadata(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (looksSensitiveKey(k)) {
      out[k] = "***";
      continue;
    }
    if (typeof v === "string") {
      out[k] = sanitize(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function looksSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes("password") ||
    k.includes("secret") ||
    k.includes("token") ||
    k.includes("api_key") ||
    k.includes("apikey") ||
    k.includes("credential") ||
    k.includes("session") ||
    k === "key" ||
    k === "pass"
  );
}
