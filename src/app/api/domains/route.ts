import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { domainToClientUsername } from "@/lib/domain-username";
import { beginJournal } from "@/lib/journal";
import { randomPanelPassword } from "@/lib/panel-password";
import { repairAvailable, repairDomainWebsite } from "@/lib/domain-repair";
import { panelVhostHostname, panelVhostAvailable } from "@/lib/panel-vhost";
import { isPremiumFeatureEnabled, loadPremiumModule } from "@/lib/premium/server";
import { requireSession } from "@/lib/session";
import { findUserByUsername } from "@/lib/users";
import { VirtualMinError } from "@/lib/errors";
import { getProvisioner } from "@/lib/provisioner";
import { consumeLastJournalSteps } from "@/lib/provisioner/native-exec";
import { isIndependentMode } from "@/lib/provisioner/native-stub";

type UsersClientModule = {
  createClientUser: (opts: {
    username: string;
    password: string;
    domains: string[];
  }) => Promise<unknown>;
  assignDomainToClient: (username: string, domain: string) => Promise<void>;
};

type PanelVhostModule = {
  ensurePanelVhost?: (domain: string) => Promise<string>;
  applyClientPanelVhost?: (domain: string) => Promise<string>;
  panelVhostAvailable?: () => Promise<boolean>;
};

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

    let clientAccount:
      | { username: string; password: string; panelUrl?: string }
      | undefined;
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
        const usersMod = await loadPremiumModule<UsersClientModule>(
          "multi-tenant-clients",
        );
        if (!usersMod) {
          premiumNote =
            "Premium licensed but module not synced. Run: node scripts/qadbak-license-cli.mjs sync";
        } else {
          const clientUsername = domainToClientUsername(domainName, body.user);
          const panelPassword = randomPanelPassword();
          const existing = await findUserByUsername(clientUsername);
          if (existing?.role === "client") {
            await usersMod.assignDomainToClient(clientUsername, domainName);
            clientAccount = {
              username: clientUsername,
              password: "(existing account — password unchanged)",
            };
          } else if (!existing) {
            await usersMod.createClientUser({
              username: clientUsername,
              password: panelPassword,
              domains: [domainName],
            });
            clientAccount = {
              username: clientUsername,
              password: panelPassword,
            };
            await auditLog(
              session.username,
              "create-client-user",
              `${clientUsername}@${domainName}`,
            );
          } else {
            premiumNote = `Client account not created: username "${clientUsername}" is already used (${existing.role}). Pick another Unix user or create the client under Domains → Overview.`;
          }
          if (body.createPanelVhost && clientAccount) {
            const host = panelVhostHostname(domainName);
            clientAccount.panelUrl = `http://${host}/`;
            if (await isPremiumFeatureEnabled("panel-client-vhost")) {
              const vhostMod = await loadPremiumModule<PanelVhostModule>(
                "panel-client-vhost",
              );
              const applyVhost =
                vhostMod?.ensurePanelVhost ?? vhostMod?.applyClientPanelVhost;
              const vhostAvailable = vhostMod?.panelVhostAvailable
                ? await vhostMod.panelVhostAvailable().catch(() => false)
                : false;
              if (applyVhost && vhostAvailable) {
                try {
                  await applyVhost(domainName);
                } catch {
                  clientAccount.panelUrl = `${clientAccount.panelUrl} (vhost script failed — run configure-panel-vhost-sudo.sh)`;
                }
              } else {
                clientAccount.panelUrl = `${clientAccount.panelUrl} (run: sudo bash scripts/configure-panel-vhost-sudo.sh)`;
              }
            } else {
              clientAccount.panelUrl = `${clientAccount.panelUrl} (panel-client-vhost Premium module not active)`;
            }
          }
        }
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

    if (clientAccount) {
      journal.infoStep(
        `Created client panel account '${clientAccount.username}' (Premium).`,
      );
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
      clientAccount,
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
