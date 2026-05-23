"use client";

import { Alert, Badge, Button, Card } from "@/components/ui";
import type { BandwidthRow, ServerService } from "@/lib/provisioner";
import { useState } from "react";

export function AdminServerView({
  initialBandwidth,
  initialServices,
  initialError,
  servicesSource = "native",
  bandwidthSource = "native",
}: {
  initialBandwidth: BandwidthRow[];
  initialServices: ServerService[];
  initialError: string;
  servicesSource?: "native" | "virtualmin";
  bandwidthSource?: "native" | "virtualmin";
}) {
  const [bandwidth] = useState(initialBandwidth);
  const [services, setServices] = useState(initialServices);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState<string | null>(null);

  async function control(service: string, action: "start" | "stop" | "restart") {
    setLoading(`${action}:${service}`);
    setError("");
    try {
      const res = await fetch("/api/admin/server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${action} failed.`);
      const listRes = await fetch("/api/admin/server");
      const listData = await listRes.json();
      if (listRes.ok) setServices(listData.services ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <Card>
        <h2 className="text-lg font-medium text-white">Services</h2>
        <p className="mt-1 text-sm text-panel-muted">
          {servicesSource === "native"
            ? "nginx, Apache, Postfix, Dovecot, BIND, MariaDB, PHP-FPM — systemctl (Qadbak host-services helper)."
            : "nginx, Apache, mail, DNS, database — via VirtualMin API."}
        </p>
        {services.length === 0 && !error && (
          <p className="mt-3 text-sm text-amber-200/90">
            No stack units detected. Install services or run{" "}
            <code className="text-xs">sudo bash scripts/configure-host-services-sudo.sh</code>.
          </p>
        )}
        <ul className="mt-4 divide-y divide-panel-border">
          {services.map((s) => (
            <li
              key={s.service}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <span className="text-white">{s.service}</span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={s.status === "running" ? "success" : "warning"}>
                  {s.status}
                </Badge>
                {s.status !== "running" && (
                  <Button
                    variant="secondary"
                    disabled={loading === `start:${s.service}`}
                    onClick={() => control(s.service, "start")}
                  >
                    {loading === `start:${s.service}` ? "…" : "Start"}
                  </Button>
                )}
                {s.status === "running" && (
                  <Button
                    variant="secondary"
                    disabled={loading === `stop:${s.service}`}
                    onClick={() => control(s.service, "stop")}
                  >
                    {loading === `stop:${s.service}` ? "…" : "Stop"}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  disabled={loading === `restart:${s.service}`}
                  onClick={() => control(s.service, "restart")}
                >
                  {loading === `restart:${s.service}` ? "…" : "Restart"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="overflow-hidden p-0">
        <h2 className="px-6 pt-6 text-lg font-medium text-white">Disk per domain</h2>
        <p className="px-6 pb-2 text-sm text-panel-muted">
          {bandwidthSource === "native"
            ? "Home directory size (MB) from du — limits from Qadbak registry / limits.json."
            : "VirtualMin bandwidth reporting."}
        </p>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="border-t border-panel-border text-panel-muted">
            <tr>
              <th className="px-6 py-3">Domain</th>
              <th className="px-6 py-3">Used (MB)</th>
              <th className="px-6 py-3">Limit</th>
            </tr>
          </thead>
          <tbody>
            {bandwidth.map((b) => (
              <tr key={b.domain} className="border-t border-panel-border/50">
                <td className="px-6 py-3 text-white">{b.domain}</td>
                <td className="px-6 py-3">{b.used ?? "—"}</td>
                <td className="px-6 py-3">{b.limit ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
