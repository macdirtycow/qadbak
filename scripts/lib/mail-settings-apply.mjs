import { chmod, chown, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  readDomainConfigJson,
  resolveDomainUser,
  resolveUnixIds,
} from "./provisioning-common.mjs";
import {
  normalizeCatchAllAddress,
  readMailSettingsCatchAllEntries,
} from "./mail-settings-catchall.mjs";

const exec = promisify(execFile);

export { normalizeCatchAllAddress, readMailSettingsCatchAllEntries };

const DEFAULTS = {
  catchAll: "",
  autoresponder: "",
  autoresponderEnabled: false,
};

async function doveadmSieveAvailable() {
  try {
    await exec("doveadm", ["--version"], { timeout: 5000 });
    const { stdout } = await exec("doveconf", ["-a"], { timeout: 10_000 });
    return /mail_plugins.*sieve/i.test(stdout) || /plugin\s*\{[^}]*sieve/i.test(stdout);
  } catch {
    return false;
  }
}

async function compileSieveScript(scriptPath, unixUser) {
  try {
    await exec("sievec", [scriptPath], { timeout: 30_000 });
    return true;
  } catch {
    try {
      await exec(
        "doveadm",
        ["sieve", "compile", "-u", unixUser, scriptPath],
        { timeout: 30_000 },
      );
      return true;
    } catch {
      return false;
    }
  }
}

/** Write Dovecot Sieve vacation autoresponder for the domain owner / catch-all mailbox. */
export async function applyAutoresponderSieve(
  unixUser,
  home,
  replyAddress,
  enabled,
  message,
) {
  const sieveDir = path.join(home, "Maildir", "sieve");
  const scriptPath = path.join(sieveDir, "qadbak-autoreply.sieve");
  const activePath = path.join(home, "Maildir", ".dovecot.sieve");

  if (!enabled || !String(message || "").trim()) {
    await rm(scriptPath, { force: true }).catch(() => {});
    await rm(`${scriptPath}c`, { force: true }).catch(() => {});
    await rm(activePath, { force: true }).catch(() => {});
    return { applied: false, reason: "disabled" };
  }

  if (!(await doveadmSieveAvailable())) {
    return {
      applied: false,
      reason:
        "Dovecot Sieve not enabled — run: sudo apt install dovecot-sieve && sudo bash scripts/configure-native-mail.sh --force",
    };
  }

  const text = String(message).trim();
  const addr = String(replyAddress).toLowerCase();
  const content = [
    'require ["vacation"];',
    "",
    `vacation :days 1 :subject "Automatic reply" :addresses ["${addr}"] text:`,
    text,
    ".",
    "",
  ].join("\n");

  await mkdir(sieveDir, { recursive: true });
  await writeFile(activePath, content, "utf8");
  await rm(scriptPath, { force: true }).catch(() => {});
  await rm(`${scriptPath}c`, { force: true }).catch(() => {});

  const ids = await resolveUnixIds(unixUser);
  if (ids) {
    const uid = Number(ids.uid);
    const gid = Number(ids.gid);
    if (!Number.isNaN(uid) && !Number.isNaN(gid)) {
      await chown(activePath, uid, gid).catch(() => {});
      await chown(path.join(home, "Maildir"), uid, gid).catch(() => {});
    }
  }
  await chmod(activePath, 0o644).catch(() => {});

  const compiled = await compileSieveScript(activePath, unixUser);

  return { applied: true, compiled, scriptPath: activePath };
}

export async function applyDomainMailSettings(domain, settings) {
  const d = String(domain).trim().toLowerCase();
  const merged = { ...DEFAULTS, ...settings };
  const { user, home } = await resolveDomainUser(d);

  const catchDest = normalizeCatchAllAddress(merged.catchAll, d);
  let replyEmail = catchDest;
  if (!replyEmail) {
    replyEmail = `${user}@${d}`;
  }

  const sieve = await applyAutoresponderSieve(
    user,
    home,
    replyEmail,
    Boolean(merged.autoresponderEnabled),
    merged.autoresponder,
  );

  return {
    catchAll: catchDest,
    autoresponder: sieve,
  };
}
