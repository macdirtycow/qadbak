import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { beginJournal } from "@/lib/journal";
import {
  consumeLastJournalSteps,
  runWithJournalStore,
} from "@/lib/provisioner/native-exec";
import { requireDomainApi } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";
import { runDomainTool } from "@/lib/panel-tools";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const users = await getProvisioner().listMailboxes(domain, session);
    return jsonOk({ users });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  return runWithJournalStore(async () => {
    let journal: ReturnType<typeof beginJournal> | undefined;
    try {
      const { session, domain } = await requireDomainApi((await params).domain);
      const body = (await request.json()) as {
        user?: string;
        pass?: string;
        real?: string;
      };
      if (!body.user || !body.pass) {
        return jsonError("Username and password are required.");
      }
      journal = beginJournal({
        action: "mailbox.add",
        summary: `Add mailbox ${body.user}@${domain}`,
        session,
        target: { domain, mailbox: body.user, user: body.user },
        metadata: { hasDisplayName: Boolean(body.real) },
      });
      consumeLastJournalSteps();
      journal.infoStep(
        `Validated input - mailbox=${body.user}, domain=${domain}, displayName=${body.real ? "yes" : "no"}`,
      );
      await getProvisioner().createMailbox(domain, body.user, body.pass, body.real, session);
      journal.captureFromHelper(consumeLastJournalSteps());
      journal.setUndoSpec({
        kind: "mailbox.add",
        payload: { domain, user: body.user },
        warning: `This will delete the mailbox ${body.user}@${domain} and its Maildir. Anything received in the meantime will be lost.`,
        ttlMinutes: 60,
      });
      await auditLog(session.username, "create-user", domain, body.user);
      const finished = await journal.finish(true);
      return jsonOk({ ok: true, journalId: finished.id });
    } catch (err) {
      if (journal) {
        journal.captureFromHelper(consumeLastJournalSteps());
        await journal.finish(false, err instanceof Error ? err.message : String(err));
      }
      return handleApiError(err);
    }
  });
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const body = (await request.json()) as { user?: string; pass?: string; quotaMb?: number };
    if (!body.user) {
      return jsonError("User is required.");
    }
    if (body.quotaMb !== undefined && body.quotaMb > 0) {
      await runDomainTool(domain, "mailbox-quota-set", {
        user: body.user,
        quotaMb: body.quotaMb,
      });
      await auditLog(session.username, "modify-mail", domain, body.user);
    }
    if (body.pass) {
      await getProvisioner().updateMailboxPassword(domain, body.user, body.pass, session);
      await auditLog(session.username, "modify-user", domain, body.user);
    }
    if (!body.pass && !(body.quotaMb !== undefined && body.quotaMb > 0)) {
      return jsonError("Provide pass and/or quotaMb.");
    }
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const body = (await request.json()) as { user?: string };
    if (!body.user) {
      return jsonError("Username is required.");
    }
    await getProvisioner().deleteMailbox(domain, body.user, session);
    await auditLog(session.username, "delete-user", domain, body.user);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
