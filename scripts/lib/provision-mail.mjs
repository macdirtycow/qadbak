import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fail, resolveDomainUser } from "./provisioning-common.mjs";
import {
  mailListDirect,
  mailCreateDirect,
  mailDeleteDirect,
  mailPassDirect,
} from "./mail-direct.mjs";
import { mailSendDirect } from "./mail-send.mjs";
import { mailSyncAll, mailDiagnose, mailReceiveTest } from "./mail-sync.mjs";
import { mailDnsHints } from "./mail-dns.mjs";

const exec = promisify(execFile);

async function virtualminAvailable() {
  try {
    await exec("bash", ["-c", "command -v virtualmin"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function useVirtualminCli() {
  const mode = process.env.QADBAK_MAIL_BACKEND?.trim().toLowerCase();
  if (mode === "direct" || mode === "postfix" || mode === "dovecot") return false;
  if (mode === "virtualmin" || mode === "cli") return true;
  const prov = process.env.QADBAK_PROVISIONER?.trim().toLowerCase();
  const fb = process.env.QADBAK_VIRTUALMIN_FALLBACK?.trim().toLowerCase();
  if (prov === "native" || fb === "false" || fb === "0" || fb === "no") {
    return false;
  }
  return true;
}

async function vmCli(args, timeout = 120_000) {
  const { stdout } = await exec("virtualmin", args, {
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

async function mailListVm(domain) {
  await resolveDomainUser(domain);
  const { emit } = await import("./provisioning-common.mjs");
  const out = await vmCli(["list-users", "--domain", domain, "--multiline"]);
  const mailboxes = [];
  for (const block of out.split(/\n(?=\S)/)) {
    const user = block.match(/^User:\s*(.+)$/m)?.[1]?.trim();
    const real = block.match(/^Real name:\s*(.+)$/m)?.[1]?.trim();
    if (user && block.includes("Mail:")) {
      mailboxes.push({ user, real, name: user });
    }
  }
  emit({ ok: true, mailboxes, source: "virtualmin-cli" });
}

async function mailCreateVm(domain, user, pass, real) {
  await resolveDomainUser(domain);
  const { emit } = await import("./provisioning-common.mjs");
  const args = [
    "create-user",
    "--domain",
    domain,
    "--user",
    user,
    "--pass",
    pass,
    "--mail",
  ];
  if (real) args.push("--real", real);
  await vmCli(args);
  emit({ ok: true, source: "virtualmin-cli" });
}

async function mailDeleteVm(domain, user) {
  await resolveDomainUser(domain);
  const { emit } = await import("./provisioning-common.mjs");
  await vmCli(["delete-user", "--domain", domain, "--user", user]);
  emit({ ok: true, source: "virtualmin-cli" });
}

async function mailPassVm(domain, user, pass) {
  await resolveDomainUser(domain);
  const { emit } = await import("./provisioning-common.mjs");
  await vmCli(["modify-user", "--domain", domain, "--user", user, "--pass", pass]);
  emit({ ok: true, source: "virtualmin-cli" });
}

async function runMail(directFn, vmFn, ...args) {
  if (useVirtualminCli() && (await virtualminAvailable())) {
    return vmFn(...args);
  }
  try {
    return await directFn(...args);
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

/** Mail: Postfix/Dovecot direct (default in native/independent), optional virtualmin CLI in hybrid. */
export async function mailList(domain) {
  await runMail(mailListDirect, mailListVm, domain);
}

export async function mailCreate(domain, user, pass, real) {
  await runMail(mailCreateDirect, mailCreateVm, domain, user, pass, real);
}

export async function mailDelete(domain, user) {
  await runMail(mailDeleteDirect, mailDeleteVm, domain, user);
}

export async function mailPass(domain, user, pass) {
  await runMail(mailPassDirect, mailPassVm, domain, user, pass);
}

export async function mailSend(domain, localUser, payloadJson) {
  if (useVirtualminCli() && (await virtualminAvailable())) {
    fail("Send from panel is only available in native mail mode (QADBAK_MAIL_BACKEND=direct).");
  }
  await mailSendDirect(domain, localUser, payloadJson);
}

export async function mailSync() {
  await mailSyncAll();
  const { emit } = await import("./provisioning-common.mjs");
  emit({ ok: true, source: "mail-sync" });
}

export async function mailDiagnoseDomain(domain, localUser) {
  const checks = await mailDiagnose(domain, localUser);
  const hints = await mailDnsHints(domain);
  const { emit } = await import("./provisioning-common.mjs");
  emit({ ok: checks.every((c) => c.ok), checks, dnsHints: hints });
}

export async function mailReceiveTestDomain(domain, localUser) {
  const result = await mailReceiveTest(domain, localUser);
  const { emit } = await import("./provisioning-common.mjs");
  emit({ ok: result.delivered, ...result, source: "local-delivery" });
}

export async function mailDnsHintsDomain(domain) {
  const hints = await mailDnsHints(domain);
  const { emit } = await import("./provisioning-common.mjs");
  emit({ ok: true, hints });
}
