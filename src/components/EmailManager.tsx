"use client";

import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
} from "@/components/ui";
import type { VirtualMinMailbox } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function EmailManager({
  domain,
  initialUsers,
  initialError,
}: {
  domain: string;
  initialUsers: VirtualMinMailbox[];
  initialError: string;
}) {
  const router = useRouter();
  const enc = encodeURIComponent(domain);
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newReal, setNewReal] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");
  const [resetUser, setResetUser] = useState<string | null>(null);
  const [resetPass, setResetPass] = useState("");

  async function refresh() {
    const res = await fetch(`/api/domains/${enc}/users`);
    const data = await res.json();
    if (res.ok) setUsers(data.users);
  }

  async function createMailbox(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: newUser,
          pass: newPass,
          real: newReal || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setSuccess(`Mailbox ${newUser}@${domain} created.`);
      setShowCreate(false);
      setNewUser("");
      setNewPass("");
      setNewReal("");
      await refresh();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!resetUser || !resetPass) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: resetUser, pass: resetPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      setSuccess(`Password for ${resetUser} updated.`);
      setResetUser(null);
      setResetPass("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: deleteTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setSuccess(`Mailbox ${deleteTarget} deleted.`);
      setDeleteTarget(null);
      setConfirmTyped("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-panel-muted">
          <Link
            href={`/domains/${enc}`}
            className="hover:text-white"
          >
            ← {domain}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Email</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Mailboxes for {domain}
        </p>
      </div>

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <div className="flex justify-end">
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "New mailbox"}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <h2 className="text-lg font-medium text-white">Create mailbox</h2>
          <form onSubmit={createMailbox} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="user">Username (local part)</Label>
              <Input
                id="user"
                value={newUser}
                onChange={(e) => setNewUser(e.target.value)}
                placeholder="info"
                required
              />
            </div>
            <div>
              <Label htmlFor="pass">Password</Label>
              <Input
                id="pass"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="real">Display name (optional)</Label>
              <Input
                id="real"
                value={newReal}
                onChange={(e) => setNewReal(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Working…" : "Create"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-panel-border bg-panel-bg/50 text-panel-muted">
            <tr>
              <th className="px-6 py-3">Mailbox</th>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Quota (MB)</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const name = u.user ?? "";
              return (
                <tr key={name} className="border-b border-panel-border/50">
                  <td className="px-6 py-4 text-white">
                    {name}@{domain}
                  </td>
                  <td className="px-6 py-4 text-panel-muted">{u.real ?? "—"}</td>
                  <td className="px-6 py-4 text-panel-muted">{u.quota ?? "—"}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setResetUser(name);
                        setResetPass("");
                      }}
                    >
                      Password
                    </Button>
                    <Button variant="danger" onClick={() => setDeleteTarget(name)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="px-6 py-8 text-center text-panel-muted">
            No mailboxes found.
          </p>
        )}
      </Card>

      {resetUser && (
        <Card>
          <h2 className="text-lg font-medium text-white">
            Change password — {resetUser}
          </h2>
          <div className="mt-4 flex max-w-md gap-2">
            <Input
              type="password"
              placeholder="New password"
              value={resetPass}
              onChange={(e) => setResetPass(e.target.value)}
            />
            <Button onClick={resetPassword} disabled={loading || !resetPass}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setResetUser(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete mailbox"
        description={`You are about to permanently delete ${deleteTarget}@${domain}.`}
        confirmLabel="Delete"
        confirmValue={deleteTarget ?? ""}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setConfirmTyped("");
        }}
        loading={loading}
      />
    </div>
  );
}
