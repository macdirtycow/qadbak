import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

export async function GET() {
  try {
    await requireAdmin();
    const r = await runProvisioningHelper("cloud-credentials-list");
    return jsonOk({ providers: r.providers ?? [] });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      id?: string;
      label?: string;
      type?: string;
      accessKey?: string;
      secretKey?: string;
      bucket?: string;
      prefix?: string;
      endpoint?: string;
    };
    if (!body.accessKey?.trim() || !body.secretKey?.trim()) {
      return jsonError("Access key and secret key are required.");
    }
    await runProvisioningHelper(
      "cloud-credentials-save",
      body.id ?? "default",
      body.label ?? "default",
      body.type ?? "s3",
      body.accessKey.trim(),
      body.secretKey.trim(),
      body.bucket?.trim() ?? "",
      body.prefix?.trim() ?? "qadbak-backups",
      body.endpoint?.trim() ?? "",
    );
    await auditLog(session.username, "cloud-credentials-save", undefined, body.id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
