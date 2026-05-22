"use client";

import { Badge, Button, Card } from "@/components/ui";
import type { VirtualMinDomain } from "@/lib/types";
import { isDomainDisabled } from "@/lib/domain-utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DomainsList({
  initialDomains,
  initialError,
  isAdmin,
}: {
  initialDomains: VirtualMinDomain[];
  initialError: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [domains, setDomains] = useState(initialDomains);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(domain: string, enable: boolean) {
    setBusy(domain);
    setError("");
    try {
      const res = await fetch(
        `/api/domains/${encodeURIComponent(domain)}/${enable ? "enable" : "disable"}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      router.refresh();
      const listRes = await fetch("/api/domains");
      const listData = await listRes.json();
      if (listRes.ok) setDomains(listData.domains);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update error.");
    } finally {
      setBusy(null);
    }
  }

  if (error && domains.length === 0) {
    return (
      <Card className="space-y-4">
        <p className="text-red-300">{error}</p>
        {isAdmin && (
          <p className="text-sm text-panel-muted">
            Check VirtualMin API (<code className="text-slate-400">npm run test-api</code> on
            the server) or create a domain below.
          </p>
        )}
        {isAdmin && (
          <Link href="/domains/new">
            <Button>New domain</Button>
          </Link>
        )}
      </Card>
    );
  }

  if (domains.length === 0) {
    return (
      <Card className="space-y-4">
        <p className="text-panel-muted">No virtual servers yet.</p>
        {isAdmin ? (
          <Link href="/domains/new">
            <Button>Create your first domain</Button>
          </Link>
        ) : (
          <p className="text-sm text-panel-muted">
            Ask an admin to assign a domain to your account.
          </p>
        )}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      {error && (
        <p className="border-b border-panel-border px-6 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead className="border-b border-panel-border bg-panel-bg/50 text-panel-muted">
          <tr>
            <th className="px-6 py-3 font-medium">Domain</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Plan</th>
            <th className="px-6 py-3 font-medium">Disk (MB)</th>
            <th className="px-6 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {domains.map((d) => {
            const disabled = isDomainDisabled(d);
            return (
              <tr key={d.name} className="border-b border-panel-border/50">
                <td className="px-6 py-4">
                  <Link
                    href={`/domains/${encodeURIComponent(d.name)}`}
                    className="font-medium text-white hover:text-panel-accent"
                  >
                    {d.name}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Badge tone={disabled ? "warning" : "success"}>
                    {disabled ? "Disabled" : "Active"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-panel-muted">{d.plan ?? "—"}</td>
                <td className="px-6 py-4 text-panel-muted">
                  {d.disk_used ?? "—"} / {d.disk_limit ?? "—"}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        router.push(`/domains/${encodeURIComponent(d.name)}/files`)
                      }
                    >
                      Files
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="secondary"
                        disabled={busy === d.name}
                        onClick={() => toggle(d.name, disabled)}
                      >
                        {busy === d.name
                          ? "Working…"
                          : disabled
                            ? "Enable"
                            : "Disable"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {domains.length === 0 && (
        <p className="px-6 py-8 text-center text-panel-muted">
          No domains to show.
        </p>
      )}
    </Card>
  );
}
