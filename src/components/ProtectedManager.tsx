"use client";

import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
} from "@/components/ui";
import type { ProtectedDirectory, ProtectedUser } from "@/lib/provisioner";
import { useDomainNavReset } from "@/hooks/useDomainNavReset";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

/** URL path under public_html (always shown with leading slash). */
function displayPath(p: string): string {
  const t = p.trim();
  if (!t) return t;
  return t.startsWith("/") ? t : `/${t}`;
}

export function ProtectedManager({
  domain,
  initialDirectories,
  initialError,
}: {
  domain: string;
  initialDirectories: ProtectedDirectory[];
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const [directories, setDirectories] = useState(initialDirectories);
  const [selectedPath, setSelectedPath] = useState(
    initialDirectories[0]?.path ?? "",
  );
  const [users, setUsers] = useState<ProtectedUser[]>([]);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [newPath, setNewPath] = useState("/private");
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");

  useDomainNavReset(domain, () => {
    setDirectories(initialDirectories);
    setSelectedPath(initialDirectories[0]?.path ?? "");
    setUsers([]);
    setError(initialError);
    setSuccess("");
    setDeletePath(null);
    setConfirmTyped("");
  });

  async function loadUsers(path: string) {
    if (!path) return;
    const res = await fetch(
      `/api/domains/${enc}/protected/users?path=${encodeURIComponent(path)}`,
    );
    const data = await res.json();
    if (res.ok) setUsers(data.users ?? []);
  }

  async function refreshDirs() {
    const res = await fetch(`/api/domains/${enc}/protected`);
    const data = await res.json();
    if (res.ok) setDirectories(data.directories ?? []);
  }

  async function addDirectory(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/protected`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: newPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setSuccess("Protected directory created.");
      await refreshDirs();
      setSelectedPath(newPath);
      await loadUsers(newPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPath) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/protected/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedPath,
          user: newUser,
          pass: newPass,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setSuccess("User added.");
      setNewUser("");
      setNewPass("");
      await loadUsers(selectedPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function removeUser(user: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${enc}/protected/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedPath, user }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      await loadUsers(selectedPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeleteDir() {
    if (!deletePath) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${enc}/protected`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deletePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setDeletePath(null);
      setConfirmTyped("");
      await refreshDirs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <DomainPageHeader
        domain={domain}
        title="Protected directories"
        description="HTTP basic auth for folders under public_html (e.g. /private, /members)"
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">Add directory</h2>
        <form onSubmit={addDirectory} className="mt-4 flex max-w-lg gap-2">
          <Input
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            placeholder="/private"
          />
          <Button type="submit" disabled={loading}>
            Add
          </Button>
        </form>
        <ul className="mt-4 space-y-2">
          {directories.map((d) => (
            <li
              key={d.path}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                selectedPath === d.path
                  ? "border-panel-accent bg-panel-accent/10"
                  : "border-panel-border"
              }`}
            >
              <button
                type="button"
                className="text-left text-white hover:underline"
                onClick={() => {
                  setSelectedPath(d.path);
                  loadUsers(d.path);
                }}
              >
                {displayPath(d.path)}
              </button>
              <Button variant="danger" onClick={() => setDeletePath(d.path)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {selectedPath && (
        <Card>
          <h2 className="text-lg font-medium text-white">
            Users for {displayPath(selectedPath)}
          </h2>
          <form onSubmit={addUser} className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Username</Label>
              <Input value={newUser} onChange={(e) => setNewUser(e.target.value)} required />
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading}>
                Add
              </Button>
            </div>
          </form>
          <ul className="mt-4 divide-y divide-panel-border">
            {users.map((u) => (
              <li key={u.user} className="flex justify-between py-3">
                <span className="text-white">{u.user}</span>
                <Button variant="danger" onClick={() => removeUser(u.user)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
          {users.length === 0 && (
            <p className="mt-2 text-sm text-panel-muted">
              No users - select a directory or add one.
            </p>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={!!deletePath}
        title="Delete directory"
        description={`Delete protected directory ${displayPath(deletePath ?? "")}?`}
        confirmLabel="Delete"
        confirmValue={deletePath ?? ""}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={confirmDeleteDir}
        onCancel={() => {
          setDeletePath(null);
          setConfirmTyped("");
        }}
        loading={loading}
      />
    </div>
  );
}
