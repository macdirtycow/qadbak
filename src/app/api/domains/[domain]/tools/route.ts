import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { runDomainTool } from "@/lib/panel-tools";

type Params = { params: Promise<{ domain: string }> };

const READ_ACTIONS = new Set([
  "dmarc-get",
  "mailbox-autoreply-list",
  "mail-bounces-list",
  "newsletter-stats-get",
  "analytics-summary",
  "git-deploy-get",
  "wp-toolkit-status",
  "maintenance-get",
  "contact-form-get",
  "staging-get",
  "bandwidth-usage",
  "redis-get",
  "ssh-keys-list",
  "awstats-config",
  "tickets-list",
  "billing-invoices-list",
  "carddav-status",
]);

const WRITE_ACTIONS = new Set([
  "dmarc-set",
  "mailbox-autoreply-set",
  "git-deploy-set",
  "git-deploy-run",
  "wp-toolkit-update",
  "maintenance-set",
  "contact-form-set",
  "staging-sync",
  "redis-set",
  "ssh-keys-add",
  "ssh-keys-delete",
  "tickets-create",
  "tickets-reply",
  "billing-invoice-create",
  "carddav-contact-upsert",
]);

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const body = (await request.json()) as { action?: string; payload?: Record<string, unknown> };
    const action = body.action?.trim();
    if (!action) return jsonError("action is required.");
    if (!READ_ACTIONS.has(action) && !WRITE_ACTIONS.has(action)) {
      return jsonError(`Unknown action: ${action}`);
    }

    const raw = await runDomainTool(domain, action, body.payload);
    if (WRITE_ACTIONS.has(action)) {
      await auditLog(session.username, `panel-tool-${action}`, domain);
    }
    return jsonOk(raw);
  } catch (err) {
    return handleApiError(err);
  }
}
