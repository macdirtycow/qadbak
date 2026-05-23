"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateDomainForm({
  parentOptions,
  initialType = "top",
}: {
  parentOptions: string[];
  initialType?: "top" | "sub" | "alias";
}) {
  const router = useRouter();
  const [type, setType] = useState<"top" | "sub" | "alias">(initialType);
  const [domain, setDomain] = useState("");
  const [pass, setPass] = useState("");
  const [user, setUser] = useState("");
  const [plan, setPlan] = useState("");
  const [parent, setParent] = useState(parentOptions[0] ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          pass,
          user: user || undefined,
          plan: plan || undefined,
          parent: type !== "top" ? parent : undefined,
          type,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setSuccess(`Domain ${domain} created.`);
      setTimeout(() => {
        router.push(`/domains/${encodeURIComponent(domain)}`);
        router.refresh();
      }, 800);
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
          <Label htmlFor="pass">Owner password</Label>
          <Input
            id="pass"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="plan">Plan (optional)</Label>
          <Input id="plan" value={plan} onChange={(e) => setPlan(e.target.value)} />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Working…" : "Create domain"}
        </Button>
      </form>
    </Card>
  );
}
