import {
  breadcrumbsFor,
  domainHomePath,
  isDirWritable,
  isPanelFilesMode,
  listDomainFiles,
  type DomainFilesListing,
} from "./domain-files";
import {
  deleteDomainFileLive,
  listDomainFilesLive,
  liveFilesEnabled,
  mkdirDomainLive,
  probeLiveFilesystem,
  readDomainFileLive,
  writeDomainFileLive,
} from "./domain-files-live";
import type { Role } from "./types";
import { createVirtualMinLoginLink } from "./virtualmin";

export async function resolveDomainFilesListing(
  domain: string,
  dir: string,
  actor: { role: Role; domains: string[] },
): Promise<{ listing: DomainFilesListing; error: string }> {
  const cwd = dir.replace(/^\/+/, "").replace(/\/+$/, "");
  const home = domainHomePath(domain);
  const base = {
    home,
    cwd,
    breadcrumbs: breadcrumbsFor(cwd),
    writable: isDirWritable(cwd),
  };

  if (isPanelFilesMode()) {
    return { listing: listDomainFiles(domain, cwd), error: "" };
  }

  if (liveFilesEnabled()) {
    try {
      const entries = await listDomainFilesLive(domain, cwd, actor);
      return {
        listing: { ...base, mode: "qadbak", entries },
        error: "",
      };
    } catch (nativeErr) {
      const hint =
        nativeErr instanceof Error ? nativeErr.message : "Native files unavailable";
      let fileManagerUrl: string | undefined;
      try {
        fileManagerUrl = await createVirtualMinLoginLink(domain, actor, {
          redirectUrl: "/filemin/index.cgi",
        });
      } catch {
        return {
          listing: { ...base, mode: "virtualmin" },
          error: `${hint}. Run on the server: sudo bash /opt/qadbak/scripts/configure-domain-fs-sudo.sh then pm2 restart qadbak.`,
        };
      }
      return {
        listing: { ...base, mode: "virtualmin", fileManagerUrl },
        error: "",
      };
    }
  }

  let fileManagerUrl: string | undefined;
  let error = "";
  try {
    fileManagerUrl = await createVirtualMinLoginLink(domain, actor, {
      redirectUrl: "/filemin/index.cgi",
    });
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load file manager.";
  }

  return {
    listing: {
      ...base,
      mode: "virtualmin",
      fileManagerUrl,
    },
    error,
  };
}

export async function liveFilesActive(): Promise<boolean> {
  return liveFilesEnabled() && (await probeLiveFilesystem());
}

export {
  readDomainFileLive,
  writeDomainFileLive,
  mkdirDomainLive,
  deleteDomainFileLive,
  uploadDomainFileLive,
} from "./domain-files-live";
