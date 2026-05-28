import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { emit, fail, QADBAK_DIR } from "./provisioning-common.mjs";

const STORE = path.join(QADBAK_DIR, "data", "cloud-credentials.json");
const ALGO = "aes-256-gcm";

function secretKey() {
  const raw = process.env.QADBAK_SECRETS_KEY?.trim() || process.env.SESSION_SECRET?.trim();
  if (!raw || raw.length < 16) {
    fail("Set QADBAK_SECRETS_KEY (16+ chars) in .env.local for cloud credential storage");
  }
  return scryptSync(raw, "qadbak-cloud-salt", 32);
}

function encrypt(text) {
  const iv = randomBytes(12);
  const key = secretKey();
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function decrypt(blob) {
  const [ivB, tagB, dataB] = String(blob).split(":");
  const key = secretKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function loadStore() {
  try {
    const raw = await readFile(STORE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { providers: [] };
  }
}

async function saveStore(data) {
  await mkdir(path.dirname(STORE), { recursive: true });
  await writeFile(STORE, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
}

export async function cloudCredentialsList() {
  const data = await loadStore();
  emit({
    ok: true,
    providers: (data.providers ?? []).map((p) => ({
      id: p.id,
      label: p.label,
      type: p.type,
      bucket: p.bucket,
      prefix: p.prefix,
      endpoint: p.endpoint,
    })),
  });
}

export async function cloudCredentialsSave(id, label, type, accessKey, secretKeyVal, bucket, prefix, endpoint) {
  const pid = String(id || "default").replace(/[^a-z0-9-_]/gi, "");
  const data = await loadStore();
  const providers = (data.providers ?? []).filter((p) => p.id !== pid);
  providers.push({
    id: pid,
    label: String(label || pid),
    type: String(type || "s3"),
    accessKeyEnc: encrypt(String(accessKey || "")),
    secretKeyEnc: encrypt(String(secretKeyVal || "")),
    bucket: String(bucket || "").trim(),
    prefix: String(prefix || "qadbak-backups").replace(/^\/+/, ""),
    endpoint: String(endpoint || "").trim(),
  });
  await saveStore({ providers });
  emit({ ok: true, id: pid });
}

export async function cloudCredentialsResolve(id) {
  const pid = String(id || "default");
  const data = await loadStore();
  const row = (data.providers ?? []).find((p) => p.id === pid);
  if (!row) fail(`Cloud provider not found: ${pid}`);
  return {
    type: row.type,
    accessKey: decrypt(row.accessKeyEnc),
    secretKey: decrypt(row.secretKeyEnc),
    bucket: row.bucket,
    prefix: row.prefix,
    endpoint: row.endpoint,
  };
}
