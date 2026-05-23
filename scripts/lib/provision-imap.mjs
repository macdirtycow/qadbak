import path from "node:path";
import { cp } from "node:fs/promises";
import { emit, fail, resolveDomainUser } from "./provisioning-common.mjs";
import { discoverMailLayout } from "./mail-layout.mjs";
import {
  authUserCandidates,
  copyMailboxDoveadm,
  doveadmAvailable,
  listDomainMailUsers,
  listMailboxesDoveadm,
  listMailboxesMaildir,
  resolveDovecotAuthUser,
  resolveMaildirRoot,
} from "./dovecot-imap.mjs";

async function layoutForDomain(domain) {
  const { user, home } = await resolveDomainUser(domain);
  return { layout: await discoverMailLayout(domain, user, home), owner: user, home };
}

export async function imapList(domain, localUser) {
  const { layout, owner, home } = await layoutForDomain(domain);
  const domainUsers = await listDomainMailUsers(layout);
  const local = String(localUser || "").trim().toLowerCase();

  if (!local) {
    emit({
      ok: true,
      users: domainUsers,
      mailboxes: [],
      hint: "Pick a mailbox user and click Load.",
      source: (await doveadmAvailable()) ? "dovecot" : "maildir",
    });
    return;
  }

  const candidates = authUserCandidates(
    domain,
    local,
    owner,
    domainUsers.map((u) => ({ user: u.user })),
  );
  const useDoveadm = await doveadmAvailable();
  let authUser = null;
  let mailboxes = [];
  let source = "maildir";

  if (useDoveadm) {
    authUser = await resolveDovecotAuthUser(candidates);
    if (authUser) {
      try {
        mailboxes = await listMailboxesDoveadm(authUser);
        if (mailboxes.length) source = "doveadm";
      } catch {
        authUser = null;
      }
    }
  }

  if (!mailboxes.length) {
    const maildirRoot = resolveMaildirRoot(layout, local, owner, home);
    authUser = local || owner;
    mailboxes = await listMailboxesMaildir(maildirRoot, authUser);
    source = "maildir";
  }

  emit({
    ok: true,
    users: domainUsers,
    authUser,
    mailboxes,
    source,
  });
}

export async function imapCopy(domain, fromBox, toBox, localUser) {
  const { layout, owner, home } = await layoutForDomain(domain);
  const local = String(localUser || "").trim().toLowerCase() || owner;
  const domainUsers = await listDomainMailUsers(layout);
  const candidates = authUserCandidates(
    domain,
    local,
    owner,
    domainUsers.map((u) => ({ user: u.user })),
  );

  if (await doveadmAvailable()) {
    const authUser = await resolveDovecotAuthUser(candidates);
    if (authUser) {
      try {
        await copyMailboxDoveadm(authUser, fromBox, toBox);
        emit({ ok: true, authUser, source: "doveadm" });
        return;
      } catch (e) {
        fail(
          e instanceof Error
            ? e.message
            : "doveadm mailbox copy failed — use mailbox names like INBOX, not file paths.",
        );
      }
    }
  }

  const maildirRoot = resolveMaildirRoot(layout, local, owner, home);
  const src = path.join(maildirRoot, fromBox.replace(/^INBOX\/?/, "").replace(/^\//, ""));
  const dst = path.join(maildirRoot, toBox.replace(/^INBOX\/?/, "").replace(/^\//, ""));
  await cp(src, dst, { recursive: true, force: false });
  emit({ ok: true, from: src, to: dst, source: "maildir" });
}
