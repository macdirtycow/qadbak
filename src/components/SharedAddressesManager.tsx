"use client";

import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
} from "@/components/ui";
import type { SharedAddress } from "@/lib/provisioner";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function SharedAddressesManager({
  domain,
  initialAddresses,
  isAdmin,
  initialError,
}: {
  domain: string;
  initialAddresses: SharedAddress[];
  isAdmin: boolean;
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const [addresses, setAddresses] = useState(initialAddresses);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [users, setUsers] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");

  async function refresh() {
    const res = await fetch(`/api/domains/${enc}/shared`);
    const data = await res.json();
    if (res.ok) setAddresses(data.addresses ?? []);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/shared`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, users }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setSuccess("Shared address created.");
      setAddress("");
      setUsers("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${enc}/shared`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: deleteTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
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
      <DomainPageHeader domain={domain} title="Shared addresses" />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {isAdmin && (
        <Card>
          <h2 className="text-lg font-medium text-white">Add address</h2>
          <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Address (local part)</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
            <div>
              <Label>Users (comma-separated)</Label>
              <Input value={users} onChange={(e) => setUsers(e.target.value)} placeholder="info,support" required />
            </div>
            <Button type="submit" disabled={loading}>Add</Button>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-panel-border bg-panel-bg/50 text-panel-muted">
            <tr>
              <th className="px-6 py-3">Address</th>
              <th className="px-6 py-3">Users</th>
              {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {addresses.map((a) => (
              <tr key={a.address} className="border-b border-panel-border/50">
                <td className="px-6 py-4 text-white">{a.address}</td>
                <td className="px-6 py-4 text-panel-muted">{a.users}</td>
                {isAdmin && (
                  <td className="px-6 py-4 text-right">
                    <Button variant="danger" onClick={() => setDeleteTarget(a.address)}>
                      Delete
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {addresses.length === 0 && (
          <p className="px-6 py-8 text-center text-panel-muted">No shared addresses.</p>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete address"
        description={`Delete ${deleteTarget}?`}
        confirmLabel="Delete"
        confirmValue={deleteTarget ?? ""}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={confirmDelete}
        onCancel={() => { setDeleteTarget(null); setConfirmTyped(""); }}
        loading={loading}
      />
    </div>
  );
}
