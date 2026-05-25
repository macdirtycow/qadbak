"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateDomainForm({
  parentOptions,
  initialType = "top",
  premiumMultiTenant = false,
}: {
  parentOptions: string[];
  initialType?: "top" | "sub" | "alias";
  premiumMultiTenant?: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<"top" | "sub" | "alias">(initialType);
  const [domain, setDomain] = useState("");
  const [pass, setPass] = useState("");
  const [user, setUser] = useState("");
  const [plan, setPlan] = useState("");
  const [parent, setParent] = useState(parentOptions[0] ?? "");
  const [createClientAccount, setCreateClientAccount] = useState(true);
  const [createPanelVhost, setCreatePanelVhost] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [clientCredentials, setClientCredentials] = useState<{
    username: string;
    password: string;
    panelUrl?: string;
  } | null>(null);
  const [unixPassword, setUnixPassword] = useState("");
  const [journalId, setJournalId] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setClientCredentials(null);
    setUnixPassword("");
    setJournalId("");
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          pass: pass || undefined,
          user: user || undefined,
          plan: plan || undefined,
          parent: type !== "top" ? parent : undefined,
          type,
          createClientAccount: type === "top" ? createClientAccount : false,
          createPanelVhost: type === "top" ? createPanelVhost : false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      if (data.clientAccount) {
        setClientCredentials(data.clientAccount);
      }
      if (data.unixPassword) {
        setUnixPassword(data.unixPassword);
      }
      if (typeof data.journalId === "string") {
        setJournalId(data.journalId);
      }
      setSuccess(`Domain ${domain} created.`);
      if (!data.clientAccount && !data.unixPassword && !data.journalId) {
        setTimeout(() => {
          router.push(`/domains/${encodeURIComponent(domain)}`);
          router.refresh();
        }, 800);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-semibold text-white">New virtual server</h1>
      <p className="mt-1 text-sm text-panel-muted">
        Creates a unix account, web root, and nginx vhost on this server (native
        provisioning). Subdomains and aliases share the parent account when selected.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <Alert>{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}
        <div>
          <Label>Type</Label>
          <select
            className="mt-1 w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as "top" | "sub" | "alias")}
          >
            <option value="top">Primary domain (virtual server)</option>
            <option value="sub">Subdomain</option>
            <option value="alias">Alias domain</option>
          </select>
        </div>
        {type !== "top" && (
          <div>
            <Label>Parent domain</Label>
            <select
              className="mt-1 w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm"
              value={parent}
              onChange={(e) => setParent(e.target.value)}
            >
              {parentOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label htmlFor="domain">Domain name</Label>
          <Input
            id="domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder={type === "sub" ? "shop.example.com" : "example.com"}
            required
          />
        </div>
        <div>
          <Label htmlFor="user">Unix user (optional)</Label>
          <Input
            id="user"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="Auto from domain name if empty"
          />
        </div>
        <div>
          <Label htmlFor="pass">Unix / hosting password (optional)</Label>
          <Input
            id="pass"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="new-password"
            placeholder="Leave empty to auto-generate"
          />
          <p className="mt-1 text-xs text-panel-muted">
            For the website/FTP system user on this server. Leave empty and one is
            generated and shown once after create. This is not the client panel login.
          </p>
        </div>
        <div>
          <Label htmlFor="plan">Plan (optional)</Label>
          <Input id="plan" value={plan} onChange={(e) => setPlan(e.target.value)} />
        </div>
        {type === "top" && premiumMultiTenant && (
          <div className="space-y-3 rounded-lg border border-panel-border bg-panel-bg/50 p-4">
            <p className="text-sm font-medium text-white">Client panel access</p>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-panel-muted">
              <input
                type="checkbox"
                className="mt-1"
                checked={createClientAccount}
                onChange={(e) => setCreateClientAccount(e.target.checked)}
              />
              <span>
                Create client account in <code className="text-xs">users.json</code>{" "}
                (username from domain; panel password is generated automatically and
                shown after create — no extra field needed)
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-panel-muted">
              <input
                type="checkbox"
                className="mt-1"
                checked={createPanelVhost}
                onChange={(e) => setCreatePanelVhost(e.target.checked)}
                disabled={!createClientAccount}
              />
              <span>
                Nginx vhost <code className="text-xs">panel.[domain]</code> → this panel
                (requires sudo rule: configure-panel-vhost-sudo.sh)
              </span>
            </label>
          </div>
        )}
        {type === "top" && !premiumMultiTenant && (
          <p className="text-sm text-panel-muted">
            Client panel accounts and <code className="text-xs">panel.[domain]</code>{" "}
            vhosts require Qadbak Premium —{" "}
            <a href="/admin/license" className="text-panel-accent hover:underline">
              activate a license
            </a>
            .
          </p>
        )}
        {unixPassword && (
          <Alert variant="success">
            <p className="font-medium text-white">
              Unix / FTP password (copy now — not shown again)
            </p>
            <p className="mt-2 text-sm">
              User: <strong>{user || domain.split(".")[0]}</strong>
              <br />
              Password: <strong>{unixPassword}</strong>
            </p>
          </Alert>
        )}
        {journalId && (
          <Alert variant="info">
            <p className="text-sm">
              <strong className="text-white">What just happened?</strong>{" "}
              See the exact nginx config, unix user creation, PHP-FPM pool and
              BIND zone we wrote for this domain.{" "}
              <a
                href={`/admin/journal?focus=${encodeURIComponent(journalId)}`}
                className="text-panel-accent hover:underline"
              >
                Open in Journal →
              </a>
            </p>
          </Alert>
        )}
        {clientCredentials && (
          <Alert variant="success">
            <p className="font-medium text-white">Client panel login (copy now — not shown again)</p>
            <p className="mt-2 text-sm">
              Username: <strong>{clientCredentials.username}</strong>
              <br />
              Password: <strong>{clientCredentials.password}</strong>
              {clientCredentials.panelUrl && (
                <>
                  <br />
                  Panel URL:{" "}
                  <a
                    className="text-emerald-300 underline"
                    href={clientCredentials.panelUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {clientCredentials.panelUrl}
                  </a>
                </>
              )}
            </p>
            <Button
              type="button"
              className="mt-3"
              variant="secondary"
              onClick={() => {
                router.push(`/domains/${encodeURIComponent(domain)}`);
                router.refresh();
              }}
            >
              Continue to domain
            </Button>
          </Alert>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? "Working…" : "Create domain"}
        </Button>
      </form>
    </Card>
  );
}
