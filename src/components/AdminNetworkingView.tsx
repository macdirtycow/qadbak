"use client";

import { Alert, Badge, Button, Card } from "@/components/ui";
import { useCallback, useEffect, useState } from "react";

type NetAddress = {
  family: string;
  address: string;
  prefix: number;
  scope?: string;
};

type NetInterface = {
  name: string;
  state: string;
  addresses: NetAddress[];
};

type NetworkSummary = {
  interfaces: NetInterface[];
  defaultRoute: string;
  primaryIpv4: string;
  originIp: string;
};

export function AdminNetworkingView() {
  const [data, setData] = useState<NetworkSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/networking");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load network data.");
      setData(json as NetworkSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-medium text-white">Server addresses</h2>
            <p className="mt-1 text-sm text-panel-muted">
              Native view of interfaces and the IP customers should point DNS at.
            </p>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-panel-muted">Loading…</p>
        ) : data ? (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-panel-border bg-panel-bg/40 p-4">
              <dt className="text-xs uppercase tracking-wide text-panel-muted">
                Primary IPv4
              </dt>
              <dd className="mt-1 font-mono text-lg text-white">
                {data.primaryIpv4 || "—"}
              </dd>
            </div>
            <div className="rounded-lg border border-panel-border bg-panel-bg/40 p-4">
              <dt className="text-xs uppercase tracking-wide text-panel-muted">
                Origin IP (DNS)
              </dt>
              <dd className="mt-1 font-mono text-lg text-white">
                {data.originIp || data.primaryIpv4 || "—"}
              </dd>
              <p className="mt-2 text-xs text-panel-muted">
                Set <code className="text-xs">QADBAK_ORIGIN_IP</code> in .env.local to
                override when behind NAT or a floating IP.
              </p>
            </div>
            {data.defaultRoute && (
              <div className="rounded-lg border border-panel-border bg-panel-bg/40 p-4 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-panel-muted">
                  Default route
                </dt>
                <dd className="mt-1 font-mono text-sm text-white">{data.defaultRoute}</dd>
              </div>
            )}
          </dl>
        ) : null}
      </Card>

      {data && data.interfaces.length > 0 && (
        <Card>
          <h2 className="text-lg font-medium text-white">Network interfaces</h2>
          <ul className="mt-4 divide-y divide-panel-border">
            {data.interfaces.map((iface) => (
              <li key={iface.name} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-white">{iface.name}</span>
                  <Badge tone={iface.state === "UP" ? "success" : "warning"}>
                    {iface.state}
                  </Badge>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-panel-muted">
                  {iface.addresses.length === 0 ? (
                    <li>No addresses</li>
                  ) : (
                    iface.addresses.map((a) => (
                      <li key={`${iface.name}-${a.address}`} className="font-mono">
                        {a.family} {a.address}/{a.prefix}
                        {a.scope ? ` (${a.scope})` : ""}
                      </li>
                    ))
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
