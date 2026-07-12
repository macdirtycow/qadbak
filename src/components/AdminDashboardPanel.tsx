"use client";

import { Alert, Button, Card } from "@/components/ui";
import type { ServerService } from "@/lib/hosting-remote";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Pm2Row = { name: string; status: string };

export function AdminDashboardPanel() {
  const [error, setError] = useState("");
  const [pm2Available, setPm2Available] = useState(true);
  const [processes, setProcesses] = useState<Pm2Row[]>([]);
  const [services, setServices] = useState<ServerService[]>([]);
  const [servicesAvailable, setServicesAvailable] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [pm2Res, svcRes] = await Promise.all([
        fetch("/api/admin/panel-control"),
        fetch("/api/admin/server"),
      ]);
      const pm2 = await pm2Res.json();
      const svc = await svcRes.json();
      if (pm2.available === false) {
        setPm2Available(false);
        setProcesses([]);
      } else if (pm2Res.ok) {
        setPm2Available(true);
        setProcesses(pm2.processes ?? []);
      }
      if (svcRes.ok) {
        setServices(svc.services ?? []);
        setServicesAvailable(svc.services?.length > 0);
      } else {
        setServicesAvailable(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load server status.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function panelAction(action: string) {
    if (
      (action === "stop" || action === "restart-all") &&
      !window.confirm(
        action === "stop"
          ? "Stop the Qadbak panel? Websites keep running; only the UI goes offline."
          : "Full panel restart (pm2-restart-qadbak.sh)? This reloads the app and terminal WS.",
      )
    ) {
      return;
    }
    setActing(action);
    setError("");
    try {
      const res = await fetch("/api/admin/panel-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      if (action === "restart-all") {
        setTimeout(load, 4000);
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setActing(null);
    }
  }

  async function serviceAction(
    service: string,
    action: "start" | "stop" | "restart",
  ) {
    setActing(`${action}:${service}`);
    setError("");
    try {
      const res = await fetch("/api/admin/server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">Qadbak panel process</h2>
        <p className="mt-1 text-sm text-panel-muted">
          pm2 - restart after config changes or if the UI hangs.
        </p>
        {!pm2Available && (
          <p className="mt-3 text-sm text-amber-200/90">
            Run:{" "}
            <code className="text-xs">
              sudo bash /opt/qadbak/scripts/configure-panel-pm2-sudo.sh
            </code>
          </p>
        )}
        {processes.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-panel-muted">
            {processes.map((p) => (
              <li key={p.name}>
                <span className="text-white">{p.name}</span> - {p.status}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!pm2Available || acting !== null}
            onClick={() => panelAction("restart")}
          >
            {acting === "restart" ? "…" : "Restart panel"}
          </Button>
          <Button
            variant="secondary"
            disabled={!pm2Available || acting !== null}
            onClick={() => panelAction("restart-terminal")}
          >
            {acting === "restart-terminal" ? "…" : "Restart terminal WS"}
          </Button>
          <Button
            variant="secondary"
            disabled={!pm2Available || acting !== null}
            onClick={() => panelAction("restart-all")}
          >
            {acting === "restart-all" ? "…" : "Full restart"}
          </Button>
          <Button
            variant="danger"
            disabled={!pm2Available || acting !== null}
            onClick={() => panelAction("stop")}
          >
            {acting === "stop" ? "…" : "Stop panel"}
          </Button>
          <Button
            variant="secondary"
            disabled={!pm2Available || acting !== null}
            onClick={() => panelAction("start")}
          >
            {acting === "start" ? "…" : "Start panel"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-white">Hosting services</h2>
          <Link
            href="/admin/server"
            className="text-sm text-panel-link hover:underline"
          >
            All services →
          </Link>
        </div>
        <p className="mt-1 text-sm text-panel-muted">
          nginx, mail, database - systemctl via host-services helper.
        </p>
        {!servicesAvailable && (
          <p className="mt-3 text-sm text-amber-200/90">
            Run:{" "}
            <code className="text-xs">
              sudo bash scripts/configure-host-services-sudo.sh
            </code>
          </p>
        )}
        <ul className="mt-4 divide-y divide-panel-border">
          {services.slice(0, 8).map((s) => (
            <li
              key={s.service}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            >
              <span className="text-white">{s.service}</span>
              <div className="flex gap-1">
                <span className="text-panel-muted">{s.status}</span>
                <Button
                  variant="ghost"
                  disabled={acting !== null}
                  onClick={() => serviceAction(s.service, "restart")}
                >
                  ↻
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
