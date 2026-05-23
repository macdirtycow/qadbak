import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { catalogModule } from "@/lib/webmin-catalog";
import {
  createWebminLoginLink,
  moduleById,
  webminModulesForAdmin,
} from "@/lib/webmin";
import { webminUiEnabled } from "@/lib/independent-mode";

export async function GET(request: Request) {
  try {
    if (!webminUiEnabled()) {
      return jsonError("Legacy panel login links are disabled.", 410);
    }
    const session = await requireAdmin();
    const url = new URL(request.url);
    const moduleId = url.searchParams.get("module");
    const redirect = url.searchParams.get("redirect");

    let redirectPath = redirect ?? undefined;
    if (moduleId) {
      const mod =
        moduleById(webminModulesForAdmin(), moduleId) ??
        catalogModule(moduleId);
      if (!mod) return jsonError("Unknown Webmin module.");
      redirectPath = mod.path;
    }

    const link = await createWebminLoginLink(session, {
      target: "root",
      redirectPath,
    });
    await auditLog(session.username, "webmin-login", undefined, moduleId ?? "root");
    return jsonOk({ url: link });
  } catch (err) {
    return handleApiError(err);
  }
}
