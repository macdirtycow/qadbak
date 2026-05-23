import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { emit, fail, resolveDomainUser } from "./provisioning-common.mjs";
import { listMailboxesFromLayout, discoverMailLayout } from "./mail-layout.mjs";
import { fileExists } from "./provisioning-common.mjs";

const exec = promisify(execFile);

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

const MAIL_CONFIGURED_STAMP = "/var/lib/qadbak/native-mail-configured";

export async function mailSendDirect(domain, localUser, payloadJson) {
  if (!(await fileExists(MAIL_CONFIGURED_STAMP))) {
    const { ensureNativeMailStack } = await import("./mail-sync.mjs");
    await ensureNativeMailStack();
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
    fail("Invalid send payload JSON");
  }

  const to = String(payload.to || "").trim();
  const subject = String(payload.subject || "");
  const body = String(payload.body ?? "");
  if (!to || !to.includes("@")) fail("Valid recipient address (to) required");

  const from = `${local}@${domain}`;
  const unixUser = local === owner ? owner : local;
  const message = buildMessage(from, to, subject, body);

  try {
    await exec(
      "runuser",
      ["-u", unixUser, "--", "sendmail", "-f", from, "-t"],
      { input: message, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    fail(`Send failed: ${msg}`);
  }

  emit({ ok: true, from, to, source: "sendmail" });
}
