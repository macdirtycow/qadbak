import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKeyScope,
} from "@/lib/api-keys";

export async function GET() {
  try {
    await requireAdmin();
    const keys = await listApiKeys();
    return jsonOk({ keys });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      label?: string;
      scopes?: ApiKeyScope[];
      resellerId?: string;
      ipAllowlist?: string[];
    };
    const scopes = body.scopes?.length ? body.scopes : (["domains:read"] as ApiKeyScope[]);
    const created = await createApiKey(body.label ?? "API key", scopes, {
      resellerId: body.resellerId,
      ipAllowlist: body.ipAllowlist,
    });
    await auditLog(session.username, "api-key-create", undefined, created.id);
    return jsonOk({ ok: true, ...created });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as { id?: string };
    if (!body.id?.trim()) return jsonError("id is required");
    await revokeApiKey(body.id.trim());
    await auditLog(session.username, "api-key-revoke", undefined, body.id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
