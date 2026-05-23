import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { access } from "node:fs/promises";
import {
  emit,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
  QADBAK_DIR,
} from "./provisioning-common.mjs";

const exec = promisify(execFile);

async function fileOk(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function detectState(domain) {
  const saved = await readDomainConfigJson(domain, "security.json", {});
  const keyDir = `/etc/opendkim/keys/${domain}/mail.private`;
  const dkimOnDisk = await fileOk(keyDir);
  let spamRunning = false;
  try {
    const { stdout } = await exec("systemctl", ["is-active", "spamassassin"], {
      timeout: 5000,
    });
    spamRunning = stdout.trim() === "active";
  } catch {
    /* */
  }
  return {
    spamEnabled: Boolean(saved.spamEnabled ?? spamRunning),
    dkimEnabled: Boolean(saved.dkimEnabled ?? dkimOnDisk),
    source: "qadbak-native",
  };
}

export async function securityGet(domain) {
  await resolveDomainUser(domain);
  const settings = await detectState(domain);
  emit({ ok: true, settings });
}

async function applySecurity(domain) {
  const script = path.join(QADBAK_DIR, "scripts", "apply-domain-mail-security.sh");
  await exec("bash", [script, domain], { timeout: 120_000 });
}

export async function securitySetSpam(domain, enabled) {
  await resolveDomainUser(domain);
  const settings = await readDomainConfigJson(domain, "security.json", {});
  settings.spamEnabled = Boolean(enabled);
  await writeDomainConfigJson(domain, "security.json", settings);
  await applySecurity(domain);
  emit({ ok: true, spamEnabled: settings.spamEnabled });
}

export async function securitySetDkim(domain, enabled) {
  await resolveDomainUser(domain);
  const settings = await readDomainConfigJson(domain, "security.json", {});
  settings.dkimEnabled = Boolean(enabled);
  await writeDomainConfigJson(domain, "security.json", settings);
  await applySecurity(domain);
  emit({ ok: true, dkimEnabled: settings.dkimEnabled });
}
