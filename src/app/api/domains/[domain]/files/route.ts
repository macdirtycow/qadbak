import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  createDomainDirectory,
  createDomainFile,
  deleteDomainFilePath,
  isPanelFilesMode,
  listDomainFiles,
  saveDomainFileContent,
} from "@/lib/domain-files";
import { requireDomainApi } from "@/lib/domain-api";
import { createVirtualMinLoginLink } from "@/lib/virtualmin";

type Params = { params: Promise<{ domain: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const url = new URL(request.url);
    const dir = url.searchParams.get("dir") ?? "";
    const listing = listDomainFiles(domain, dir);
    let fileManagerUrl: string | undefined;
    if (listing.mode === "virtualmin") {
      fileManagerUrl = await createVirtualMinLoginLink(domain, session, {
        redirectUrl: "/filemin/index.cgi",
      });
    }
    return jsonOk({ ...listing, fileManagerUrl });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    if (!isPanelFilesMode()) {
      return jsonError(
        "File actions on the server are done via the VirtualMin file manager. Open Files in Nexmin.",
        501,
      );
    }
    const body = (await request.json()) as {
      action?: string;
      path?: string;
      content?: string;
      parent?: string;
      name?: string;
    };

    if (body.action === "mkdir") {
      if (!body.name) return jsonError("Directory name is required.");
      const path = createDomainDirectory(body.parent ?? "", body.name);
      await auditLog(session.username, "create-directory", domain, path);
      return jsonOk({ path });
    }

    if (body.action === "save") {
      if (!body.path || body.content === undefined) {
        return jsonError("Path and content are required.");
      }
      saveDomainFileContent(body.path, body.content);
      await auditLog(session.username, "save-file", domain, body.path);
      return jsonOk({ ok: true });
    }

    if (body.action === "create-file") {
      if (!body.name) return jsonError("File name is required.");
      const path = createDomainFile(
        body.parent ?? "",
        body.name,
        body.content ?? "",
      );
      await auditLog(session.username, "create-file", domain, path);
      return jsonOk({ path });
    }

    return jsonError("Unknown action.");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    if (!isPanelFilesMode()) {
      return jsonError("Deleting in Nexmin is not available on the live server.", 501);
    }
    const body = (await request.json()) as { path?: string };
    if (!body.path) return jsonError("Path is required.");
    deleteDomainFilePath(body.path);
    await auditLog(session.username, "delete-file", domain, body.path);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
