import { writeFile, mkdir, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { emit, fail, resolveDomainUser, fileExists } from "./provisioning-common.mjs";
import { listMailboxesFromLayout, discoverMailLayout } from "./mail-layout.mjs";
import { deliverLocalMessage, queueSendmail } from "./mail-queue.mjs";

const SENDMAIL = "/usr/sbin/sendmail";
const MAIL_CONFIGURED_STAMP = "/var/lib/qadbak/native-mail-configured";
const DOVECOT_NATIVE_CONF = "/etc/dovecot/conf.d/99-qadbak-native.conf";

async function ensureMailReady() {
  if (await fileExists(MAIL_CONFIGURED_STAMP)) return;
  if (await fileExists(DOVECOT_NATIVE_CONF)) {
    await mkdir("/var/lib/qadbak", { recursive: true });
    await writeFile(MAIL_CONFIGURED_STAMP, "ok\n", "utf8");
    return;
  }
  const { ensureNativeMailStack } = await import("./mail-sync.mjs");
  await ensureNativeMailStack();
}

function buildMessage(from, to, subject, body, opts = {}) {
  const subj = String(subject || "").replace(/\r?\n/g, " ").trim() || "(no subject)";
  const text = String(body ?? "");
  const lines = [`From: ${from}`, `To: ${to}`];
  const cc = String(opts.cc || "").trim();
  if (cc) lines.push(`Cc: ${cc}`);
  lines.push(`Subject: ${subj}`);
  const inReplyTo = String(opts.inReplyTo || "").trim();
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  const references = String(opts.references || "").trim();
  if (references) lines.push(`References: ${references}`);
  lines.push(
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
  );
  return lines.join("\r\n");
}

export async function mailSendDirect(domain, localUser, payloadJson) {
  await ensureMailReady();
  if (!(await fileExists(SENDMAIL))) {
    fail("sendmail not found — install postfix");
  }

  const { user: owner, home } = await resolveDomainUser(domain);
  const layout = await discoverMailLayout(domain, owner, home);
  const mailboxes = await listMailboxesFromLayout(layout);
  const local = String(localUser || owner).trim().toLowerCase();

  const allowed = mailboxes.some((m) => m.user.toLowerCase() === local);
  if (!allowed) fail(`Unknown mailbox user: ${local}`);

  let payload;
  try {
    payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  } catch {
    fail("Invalid send payload JSON — wrap payload in single quotes on the CLI");
  }

  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "");
  const body = String(payload.body ?? "");
  const cc = String(payload.cc || "").trim();
  const inReplyTo = String(payload.inReplyTo || "").trim();
  const references = String(payload.references || "").trim();
  if (!to || !to.includes("@")) fail("Valid recipient address (to) required");

  const from = `${local}@${domain}`;
  const message = buildMessage(from, to, subject, body, {
    cc,
    inReplyTo,
    references,
  });

  const toDomain = to.split("@")[1]?.toLowerCase() ?? "";
  const sameDomain = toDomain === domain.toLowerCase();

  try {
    if (sameDomain) {
      await deliverLocalMessage(to, subject, body, from);
      emit({ ok: true, from, to, source: "smtp-local" });
      return;
    }
    await queueSendmail(from, message);
    emit({ ok: true, from, to, source: "sendmail" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`Send failed: ${msg}`);
  }
}
