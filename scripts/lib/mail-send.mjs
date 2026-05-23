import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { emit, fail, resolveDomainUser, fileExists } from "./provisioning-common.mjs";
import { listMailboxesFromLayout, discoverMailLayout } from "./mail-layout.mjs";

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

function buildMessage(from, to, subject, body) {
  const subj = String(subject || "").replace(/\r?\n/g, " ").trim() || "(no subject)";
  const text = String(body ?? "");
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subj}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
  ].join("\r\n");
}

/** Queue mail via Postfix sendmail (provisioning helper runs as root). */
function queueSendmail(from, message, timeoutMs = 25_000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(SENDMAIL, ["-f", from, "-t", "-i"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("sendmail timed out — check Postfix logs (mail.log)"));
    }, timeoutMs);

    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `sendmail exited with code ${code}`));
    });
    proc.stdin.write(message);
    proc.stdin.end();
  });
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
  if (!to || !to.includes("@")) fail("Valid recipient address (to) required");

  const from = `${local}@${domain}`;
  const message = buildMessage(from, to, subject, body);

  try {
    await queueSendmail(from, message);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`Send failed: ${msg}`);
  }

  emit({ ok: true, from, to, source: "sendmail" });
}
