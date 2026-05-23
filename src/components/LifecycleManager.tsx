"use client";

import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
} from "@/components/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function LifecycleManager({
  domain,
  initialValidation,
  initialError,
  independentMode = false,
}: {
  domain: string;
  initialValidation: { valid: boolean; messages: string[] };
  initialError: string;
  independentMode?: boolean;
}) {
  const router = useRouter();
  const enc = encodeURIComponent(domain);
  const [validation, setValidation] = useState(initialValidation);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [destHost, setDestHost] = useState("");
  const [newOwner, setNewOwner] = useState("");

  async function refreshValidation() {
    const res = await fetch(`/api/domains/${enc}/lifecycle`);
    const data = await res.json();
    if (res.ok) setValidation(data.validation);
  }

  async function runAction(action: string) {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          confirm: domain,
          newDomain: action === "clone" ? newDomain : undefined,
          destHost: action === "migrate" ? destHost : undefined,
          newOwner: action === "transfer" ? newOwner : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
        return;
      }
      if (data.messages?.length) {
        setSuccess(data.messages.join("\n"));
      } else {
        setSuccess("Action completed.");
      }
      if (data.domain) {
        router.push(`/domains/${encodeURIComponent(data.domain)}`);
      }
      setConfirmAction(null);
      setConfirmTyped("");
      await refreshValidation();
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
        title="Lifecycle"
        description="Validate, clone, migrate, transfer, delete"
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">Validation</h2>
        <div className="mt-3 flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              validation.valid
                ? "bg-emerald-900/50 text-emerald-300"
                : "bg-red-900/50 text-red-300"
            }`}
          >
            {validation.valid ? "OK" : "Issues"}
          </span>
          <Button variant="ghost" onClick={refreshValidation}>
            Check again
          </Button>
        </div>
        <ul className="mt-3 list-inside list-disc text-sm text-panel-muted">
          {validation.messages.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Clone</h2>
        <div className="mt-4 flex max-w-md gap-2">
          <Input
            placeholder="new.example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => setConfirmAction("clone")}
            disabled={!newDomain}
          >
            Clone
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Migrate</h2>
        {independentMode && (
          <p className="mt-1 text-sm text-panel-muted">
            Creates a backup tarball and shows steps for the target host (no VirtualMin
            migrate-domain).
          </p>
        )}
        <div className="mt-4 flex max-w-md gap-2">
          <Input
            placeholder="target-server.example.com"
            value={destHost}
            onChange={(e) => setDestHost(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => setConfirmAction("migrate")}
            disabled={!destHost}
          >
            {independentMode ? "Prepare migrate" : "Migrate"}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Transfer ownership</h2>
        {independentMode && (
          <p className="mt-1 text-sm text-panel-muted">
            Assigns the domain to another panel user (client). Unix owner is unchanged.
          </p>
        )}
        <div className="mt-4 flex max-w-md gap-2">
          <Input
            placeholder={independentMode ? "panel username (client)" : "new-user"}
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => setConfirmAction("transfer")}
            disabled={!newOwner}
          >
            Transfer
          </Button>
        </div>
      </Card>

      <Card className="border-red-900/40">
        <h2 className="text-lg font-medium text-red-300">Danger zone</h2>
        <p className="mt-1 text-sm text-panel-muted">
          {independentMode
            ? "Removes nginx vhost, registry entry, and unix user when marked by Qadbak."
            : "Permanently removes the virtual server from VirtualMin."}
        </p>
        <Button
          className="mt-4"
          variant="danger"
          onClick={() => setConfirmAction("delete")}
        >
          Delete domain
        </Button>
      </Card>

      <ConfirmDialog
        open={!!confirmAction}
        title={`Confirm: ${confirmAction}`}
        description={`Type the domain name ${domain} to perform ${confirmAction}.`}
        confirmLabel="Execute"
        confirmValue={domain}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={() => confirmAction && runAction(confirmAction)}
        onCancel={() => {
          setConfirmAction(null);
          setConfirmTyped("");
        }}
        loading={loading}
      />
    </div>
  );
}
