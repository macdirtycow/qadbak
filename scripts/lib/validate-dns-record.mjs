/**
 * DNS record validation — prevent zone file injection via newlines/control chars.
 */

const ALLOWED_TYPES = new Set([
  "A",
  "AAAA",
  "CNAME",
  "MX",
  "TXT",
  "NS",
  "SRV",
  "PTR",
  "CAA",
]);

const LABEL_RE = /^(@|\*|[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*)$/;

/**
 * @param {object} record
 */
export function validateDnsRecord(record) {
  if (!record || typeof record !== "object") {
    throw new Error("Invalid DNS record.");
  }
  const type = String(record.type || "").trim().toUpperCase();
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error(`Unsupported DNS record type: ${type}`);
  }
  const name = String(record.name ?? "@").trim();
  if (!LABEL_RE.test(name)) {
    throw new Error("Invalid DNS record name.");
  }
  const value = String(record.value ?? "").trim();
  if (!value || value.length > 2048) {
    throw new Error("Invalid DNS record value.");
  }
  if (/[\r\n\x00]/.test(value) || /[\r\n\x00]/.test(name)) {
    throw new Error("DNS record contains control characters.");
  }
  if (record.priority != null) {
    const pri = Number(record.priority);
    if (!Number.isInteger(pri) || pri < 0 || pri > 65535) {
      throw new Error("Invalid DNS record priority.");
    }
  }
  return { ...record, type, name, value };
}
