import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { beginJournal } from "@/lib/journal";
import { randomPanelPassword } from "@/lib/panel-password";
import { repairAvailable, repairDomainWebsite } from "@/lib/domain-repair";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";
import { requireSession } from "@/lib/session";
import { VirtualMinError } from "@/lib/errors";
import { getProvisioner } from "@/lib/provisioner";
import {
  consumeLastJournalSteps,
  runWithJournalStore,
} from "@/lib/provisioner/native-exec";
import { isIndependentMode } from "@/lib/provisioner/native-stub";

export async function GET() {
  try {
    const session = await requireSession();
    const domains = await getProvisioner().listDomains(session);
    await auditLog(session.username, "list-domains");
    return jsonOk({ domains });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  return runWithJournalStore(async () => doCreateDomain(request));
}

async function doCreateDomain(request: Request) {
  let journal: ReturnType<typeof beginJournal> | undefined;
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      domain?: string;
      pass?: string;
      user?: string;
      plan?: string;
      parent?: string;
      type?: "top" | "sub" | "alias";
      createClientAccount?: boolean;
      createPanelVhost?: boolean;
    };
    if (!body.domain) {
      return jsonError("Domain name is required.");
    }
    const domainName = body.domain.trim().toLowerCase();
    const providedPass = body.pass?.trim() ?? "";
    const unixPass = providedPass || randomPanelPassword();
    const unixPassGenerated = !providedPass;

    journal = beginJournal({
      action: "domain.create",
      summary: `Create domain ${domainName}`,
      session,
      target: { domain: domainName },
      undoable: false,
      metadata: {
        type: body.type ?? "top",
        plan: body.plan ?? "Default",
        parent: body.parent ?? undefined,
        createClientAccount: body.createClientAccount !== false,
        createPanelVhost: Boolean(body.createPanelVhost),
        unixUserProvided: Boolean(body.user),
        passwordGenerated: unixPassGenerated,
      },
    });
    consumeLastJournalSteps(); // discard any leftover from earlier requests
    journal.infoStep(`Validated input — domain="${domainName}", type=${body.type ?? "top"}`);

    try {
      await getProvisioner().createDomain(
        {
          domain: domainName,
          pass: unixPass,
          user: body.user,
          plan: body.plan,
          parent: body.parent,
          type: body.type,
          alias: body.type === "alias",
          subdom: body.type === "sub",
        },
        session,
      );
      journal.captureFromHelper(consumeLastJournalSteps());
    } catch (err) {
      journal.captureFromHelper(consumeLastJournalSteps());
      if (
        err instanceof VirtualMinError &&
        /already exists|already been created|already in use/i.test(err.message)
      ) {
        const existing = await getProvisioner().findDomainByName(domainName, session);
        if (existing) {
          journal.warnStep(
            `Domain already existed on this server — treating as success.`,
          );
          await journal.finish(true);
          return jsonOk({
            ok: true,
            domain: existing.name,
            note: "Domain already existed on this server.",
            journalId: journal.id,
          });
        }
      }
      throw err;
    }

    let created: Awaited<
      ReturnType<ReturnType<typeof getProvisioner>["findDomainByName"]>
    > | undefined;
    for (let attempt = 0; attempt < 10; attempt++) {
      created = await getProvisioner().findDomainByName(domainName, session);
      if (created) break;
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (!created) {
      const listed = await getProvisioner().listDomains(session).catch(() => []);
      const known = listed.some((d) => d.name.toLowerCase() === domainName);
      if (known) {
        return jsonOk({ ok: true, domain: domainName });
      }
      const hint =
        listed.length === 0
          ? isIndependentMode()
            ? "Qadbak cannot read domains (check data/native-domains.json and pm2 env). Run: cd /opt/qadbak && git pull && sudo bash scripts/pm2-restart-qadbak.sh "
            : "Qadbak cannot read domains (pm2 may not load .env.local). Run: cd /opt/qadbak && git pull && sudo bash scripts/pm2-restart-qadbak.sh && npm run test-api. "
          : `This server has ${listed.length} domain(s) but not "${domainName}". `;
      return jsonError(
        hint +
          "If the domain already exists, open Domains in the menu instead of creating it again.",
        502,
      );
    }

    await auditLog(session.username, "create-domain", domainName);
    journal.infoStep(`Domain '${domainName}' visible in registry after lookup retry.`);

    // Premium client provisioning (multi-tenant-clients,
    // panel-client-vhost) is gated by isPremiumFeatureEnabled. The
    // actual implementation will land as static TypeScript under
    // src/lib/premium/ in a follow-up commit; until then we surface a
    // clear premiumNote instead of pretending to create the account.
    let premiumNote: string | undefined;
    const wantClient =
      body.type !== "sub" &&
      body.type !== "alias" &&
      body.createClientAccount !== false;
    if (wantClient) {
      if (!(await isPremiumFeatureEnabled("multi-tenant-clients"))) {
        premiumNote =
          "Client account not created — Qadbak Premium license required (Server admin → License).";
      } else {
        premiumNote =
          "Premium licensed — multi-tenant client provisioning module not yet available in this build.";
      }
    }

    let hostingNote: string | undefined;
    if (await repairAvailable()) {
      try {
        await repairDomainWebsite(created.name);
        journal.captureFromHelper(consumeLastJournalSteps());
        journal.infoStep(
          `Re-applied per-domain nginx + permissions via Repair helper.`,
        );
        hostingNote =
          "Website hosting configured for this domain (nginx public_html vhost, same as Repair).";
      } catch {
        journal.captureFromHelper(consumeLastJournalSteps());
        journal.warnStep(
          `Repair helper failed — site may need a manual run from Domains → Overview.`,
        );
        hostingNote =
          "Domain created. Open Overview → Repair on server if the site does not load yet.";
      }
    }

    if (premiumNote) {
      journal.warnStep(`Premium note: ${premiumNote}`);
    }

    const finished = await journal.finish(true);

    return jsonOk({
      ok: true,
      domain: created.name,
      hostingNote,
      premiumNote,
      unixPassword: unixPassGenerated ? unixPass : undefined,
      journalId: finished.id,
    });
  } catch (err) {
    if (journal) {
      journal.captureFromHelper(consumeLastJournalSteps());
      await journal.finish(false, err instanceof Error ? err.message : String(err));
    }
    return handleApiError(err);
  }
}
