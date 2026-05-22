import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { emit, fail, resolveDomainUser } from "./provisioning-common.mjs";

const exec = promisify(execFile);

async function vmCli(args, timeout = 120_000) {
  const { stdout } = await exec("virtualmin", args, {
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

/** Native mail via VirtualMin CLI (no remote.cgi) — works until Postfix maps are managed directly. */
export async function mailList(domain) {
  await resolveDomainUser(domain);
  try {
    const out = await vmCli(["list-users", "--domain", domain, "--multiline"]);
    const mailboxes = [];
    for (const block of out.split(/\n(?=\S)/)) {
      const user = block.match(/^User:\s*(.+)$/m)?.[1]?.trim();
      const real = block.match(/^Real name:\s*(.+)$/m)?.[1]?.trim();
      if (user && block.includes("Mail:")) {
        mailboxes.push({ user, real, name: user });
      }
    }
    if (mailboxes.length) {
      emit({ ok: true, mailboxes, source: "virtualmin-cli" });
      return;
    }
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  emit({ ok: true, mailboxes: [], source: "virtualmin-cli" });
}

export async function mailCreate(domain, user, pass, real) {
  await resolveDomainUser(domain);
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

export async function mailDelete(domain, user) {
  await resolveDomainUser(domain);
  await vmCli(["delete-user", "--domain", domain, "--user", user]);
  emit({ ok: true });
}

export async function mailPass(domain, user, pass) {
  await resolveDomainUser(domain);
  await vmCli(["modify-user", "--domain", domain, "--user", user, "--pass", pass]);
  emit({ ok: true });
}
