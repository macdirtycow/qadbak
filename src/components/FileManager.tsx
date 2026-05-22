"use client";

import { FileCodeEditor } from "@/components/FileCodeEditor";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
} from "@/components/ui";
import {
  DOMAIN_FILE_QUICK_PATHS,
  type DomainFileEntry,
  type DomainFilesListing,
} from "@/lib/domain-files";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { WebminEmbed } from "@/components/WebminEmbed";
import { DomainPageHeader } from "./DomainPageHeader";

export function FileManager({
  domain,
  initialListing,
  initialError,
}: {
  domain: string;
  initialListing: DomainFilesListing;
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listing, setListing] = useState(initialListing);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [newDirName, setNewDirName] = useState("");
  const [showNewDir, setShowNewDir] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [showNewFile, setShowNewFile] = useState(false);

  const [editPath, setEditPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editLanguage, setEditLanguage] = useState("plaintext");
  const [editReadOnly, setEditReadOnly] = useState(false);

  const [deletePath, setDeletePath] = useState<string | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");

  const refresh = useCallback(
    async (dir?: string) => {
      const cwd = dir ?? listing.cwd;
      const res = await fetch(`/api/domains/${enc}/files?dir=${encodeURIComponent(cwd)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load directory.");
      setListing(data);
    },
    [enc, listing.cwd],
  );

  async function openFileManager() {
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/virtualmin-link?dest=fileman`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Link failed.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    }
  }

  async function navigate(dir: string) {
    setLoading(true);
    setError("");
    setEditPath(null);
    try {
      await refresh(dir);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function openEditor(entry: DomainFileEntry, forceReadOnly = false) {
    if (entry.type === "dir") {
      await navigate(entry.path);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/domains/${enc}/files/content?path=${encodeURIComponent(entry.path)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open file.");
      if (data.encoding === "base64") {
        setError(
          "This is a binary file. Use Download — editing is only available for text files.",
        );
        return;
      }
      setEditPath(entry.path);
      setEditContent(data.content ?? "");
      setEditLanguage(data.language ?? "plaintext");
      setEditReadOnly(forceReadOnly || data.readOnly === true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  function downloadUrl(path: string) {
    return `/api/domains/${enc}/files/download?path=${encodeURIComponent(path)}`;
  }

  async function saveFile() {
    if (!editPath || editReadOnly) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", path: editPath, content: editContent }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSuccess("File saved.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    if (!listing.writable) {
      setError("This directory is read-only.");
      return;
    }
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const form = new FormData();
      form.set("dir", listing.cwd);
      for (const f of files) form.append("files", f);
      const res = await fetch(`/api/domains/${enc}/files/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setSuccess(
        files.length === 1
          ? `${files[0]!.name} uploaded.`
          : `${files.length} files uploaded.`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function createDir(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mkdir",
          parent: listing.cwd,
          name: newDirName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create directory failed.");
      setShowNewDir(false);
      setNewDirName("");
      setSuccess("Directory created.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function createFile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-file",
          parent: listing.cwd,
          name: newFileName,
          content: "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create file failed.");
      setShowNewFile(false);
      setNewFileName("");
      setSuccess("File created.");
      await refresh();
      if (data.path) {
        await openEditor({
          name: newFileName,
          path: data.path,
          type: "file",
          editable: true,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deletePath) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${enc}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deletePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      if (editPath === deletePath) setEditPath(null);
      setDeletePath(null);
      setConfirmTyped("");
      setSuccess("Deleted.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  const isQadbak = listing.mode === "qadbak";
  const writable = listing.writable !== false;

  return (
    <div className="space-y-6">
      <DomainPageHeader
        domain={domain}
        title="Files"
        description={`${listing.home} · document root: public_html`}
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div className="flex flex-wrap gap-2">
        {DOMAIN_FILE_QUICK_PATHS.map((q) => (
          <Button
            key={q.id}
            variant="secondary"
            disabled={loading}
            onClick={() => navigate(q.id)}
            title={q.description}
          >
            {q.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          disabled={loading}
          onClick={() => window.location.assign(`/domains/${enc}/webmin`)}
        >
          All Webmin modules
        </Button>
        <Button variant="ghost" onClick={openFileManager} disabled={loading}>
          {isQadbak ? "File manager (direct)" : "Open file manager"}
        </Button>
      </div>

      {!isQadbak && listing.fileManagerUrl && (
        <WebminEmbed
          title="File manager"
          description="Webmin file manager for this domain (public_html and home)."
          fetchUrl={`/api/domains/${enc}/virtualmin-link?dest=fileman`}
          initialUrl={listing.fileManagerUrl}
          height="min(70vh, 720px)"
        />
      )}
      {!isQadbak && !listing.fileManagerUrl && (
        <Alert>
          File manager link unavailable. Run on the server:{" "}
          <code className="text-white">
            sudo bash /opt/qadbak/scripts/configure-domain-fs-sudo.sh
          </code>{" "}
          then rebuild and restart Qadbak — or fix VirtualMin create-login-link.
        </Alert>
      )}

      {isQadbak && (
        <>
          {writable && (
            <Card
              className={`border-dashed transition ${dragOver ? "border-panel-accent bg-panel-accent/5" : ""}`}
            >
              <div
                className="flex flex-wrap items-center justify-between gap-3"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
                }}
              >
                <div>
                  <p className="font-medium text-white">Upload</p>
                  <p className="text-sm text-panel-muted">
                    Drag files here or choose from your computer (max. 10 MB per file).
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) uploadFiles(e.target.files);
                    }}
                  />
                  <Button
                    variant="secondary"
                    disabled={loading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose files
                  </Button>
                  <Button variant="secondary" disabled={loading} onClick={() => setShowNewFile(true)}>
                    New file
                  </Button>
                  <Button variant="secondary" disabled={loading} onClick={() => setShowNewDir(true)}>
                    New directory
                  </Button>
                  <Button variant="ghost" disabled={loading} onClick={() => refresh()}>
                    Vernieuwen
                  </Button>
                </div>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-border px-4 py-3">
              <nav className="flex flex-wrap items-center gap-1 text-sm">
                {listing.breadcrumbs.map((crumb, i) => (
                  <span key={crumb.path} className="flex items-center gap-1">
                    {i > 0 && <span className="text-panel-muted">/</span>}
                    <button
                      type="button"
                      className="text-panel-accent hover:underline"
                      onClick={() => navigate(crumb.path)}
                    >
                      {crumb.label}
                    </button>
                  </span>
                ))}
              </nav>
              {!writable && (
                <span className="text-xs text-amber-400/90">Read-only directory</span>
              )}
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-panel-border bg-panel-bg/40 text-panel-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Modified</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listing.cwd && (
                  <tr className="border-b border-panel-border/50">
                    <td className="px-4 py-3" colSpan={4}>
                      <button
                        type="button"
                        className="text-panel-accent hover:underline"
                        onClick={() => {
                          const parts = listing.cwd.split("/");
                          parts.pop();
                          navigate(parts.join("/"));
                        }}
                      >
                        ..
                      </button>
                    </td>
                  </tr>
                )}
                {(listing.entries ?? []).map((entry) => (
                  <tr
                    key={entry.path}
                    className="border-b border-panel-border/50 hover:bg-panel-bg/30"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="text-left font-medium text-white hover:text-panel-accent"
                        onClick={() => openEditor(entry)}
                      >
                        <span className="mr-2 inline-block w-14 text-xs uppercase text-panel-muted">
                          {entry.type === "dir" ? "dir" : "file"}
                        </span>
                        {entry.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-panel-muted">
                      {entry.type === "dir" ? "—" : entry.size ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-panel-muted">{entry.modified ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {entry.type === "file" && entry.downloadable !== false && (
                          <a
                            href={downloadUrl(entry.path)}
                            className="rounded-lg px-2 py-1 text-xs text-panel-muted hover:bg-panel-card hover:text-white"
                            download
                          >
                            Download
                          </a>
                        )}
                        {entry.type === "file" && (
                          <Button
                            variant="ghost"
                            className="!px-2 !py-1 text-xs"
                            onClick={() =>
                              openEditor(
                                entry,
                                entry.editable === false,
                              )
                            }
                          >
                            {entry.editable === false ? "Bekijken" : "Bewerken"}
                          </Button>
                        )}
                        {entry.type === "file" &&
                          entry.editable !== false &&
                          writable && (
                            <Button
                              variant="ghost"
                              className="!px-2 !py-1 text-xs text-red-300"
                              onClick={() => setDeletePath(entry.path)}
                            >
                              Delete
                            </Button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(listing.entries ?? []).length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-panel-muted">
                This directory is empty. Upload files or create a new file.
              </p>
            )}
          </Card>

          {showNewDir && (
            <Card>
              <h2 className="text-lg font-medium text-white">New directory</h2>
              <form onSubmit={createDir} className="mt-4 flex flex-wrap gap-2">
                <Input
                  placeholder="directory name"
                  value={newDirName}
                  onChange={(e) => setNewDirName(e.target.value)}
                  required
                />
                <Button type="submit" disabled={loading}>
                  Create
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNewDir(false)}>
                  Annuleren
                </Button>
              </form>
            </Card>
          )}

          {showNewFile && (
            <Card>
              <h2 className="text-lg font-medium text-white">New file</h2>
              <form onSubmit={createFile} className="mt-4 flex flex-wrap gap-2">
                <Input
                  placeholder="e.g. page.html or script.js"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  required
                />
                <Button type="submit" disabled={loading}>
                  Create and edit
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowNewFile(false)}>
                  Annuleren
                </Button>
              </form>
            </Card>
          )}

          {editPath && (
            <FileCodeEditor
              path={editPath}
              language={editLanguage}
              readOnly={editReadOnly}
              content={editContent}
              onChange={setEditContent}
              onSave={saveFile}
              onClose={() => setEditPath(null)}
              saving={loading}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deletePath}
        title="Delete file"
        description={`Delete ${deletePath}? This cannot be undone.`}
        confirmLabel="Delete"
        confirmValue={deletePath?.split("/").pop() ?? ""}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeletePath(null);
          setConfirmTyped("");
        }}
        loading={loading}
      />
    </div>
  );
}
