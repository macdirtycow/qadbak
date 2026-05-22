import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  createDomainDirectory,
  createDomainFile,
  deleteDomainFilePath,
  isPanelFilesMode,
  normalizeDir,
  saveDomainFileContent,
} from "@/lib/domain-files";
import {
  deleteDomainFileLive,
  liveFilesEnabled,
  mkdirDomainLive,
  resolveDomainFilesListing,
  writeDomainFileLive,
} from "@/lib/domain-files-service";
import { requireDomainApi } from "@/lib/domain-api";

type Params = { params: Promise<{ domain: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const url = new URL(request.url);
    const dir = url.searchParams.get("dir") ?? "";
    const { listing } = await resolveDomainFilesListing(domain, dir, session);
    return jsonOk(listing);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const live = liveFilesEnabled();
    if (!isPanelFilesMode() && !live) {
      return jsonError(
        "File actions on the server are done via the VirtualMin file manager. Open Files in Qadbak.",
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
      const path = live
        ? await mkdirDomainLive(domain, body.parent ?? "", body.name, session)
        : createDomainDirectory(body.parent ?? "", body.name);
      await auditLog(session.username, "create-directory", domain, path);
      return jsonOk({ path });
    }

    if (body.action === "save") {
      if (!body.path || body.content === undefined) {
        return jsonError("Path and content are required.");
      }
      if (live) {
        await writeDomainFileLive(domain, body.path, body.content, session);
      } else {
        saveDomainFileContent(body.path, body.content);
      }
      await auditLog(session.username, "save-file", domain, body.path);
      return jsonOk({ ok: true });
    }

    if (body.action === "create-file") {
      if (!body.name) return jsonError("File name is required.");
      let path: string;
      if (live) {
        const parentNorm = normalizeDir(body.parent ?? "");
        const safe = body.name.replace(/[/\\]/g, "").trim();
        if (!safe) return jsonError("Invalid file name.");
        path = parentNorm ? `${parentNorm}/${safe}` : safe;
        await writeDomainFileLive(domain, path, body.content ?? "", session);
      } else {
        path = createDomainFile(
          body.parent ?? "",
          body.name,
          body.content ?? "",
        );
      }
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
    const live = liveFilesEnabled();
    if (!isPanelFilesMode() && !live) {
      return jsonError("Deleting in Qadbak is not available on the live server.", 501);
    }
    const body = (await request.json()) as { path?: string };
    if (!body.path) return jsonError("Path is required.");
    if (live) {
      await deleteDomainFileLive(domain, body.path, session);
    } else {
      deleteDomainFilePath(body.path);
    }
    await auditLog(session.username, "delete-file", domain, body.path);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
