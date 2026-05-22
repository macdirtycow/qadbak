"use client";

import { Alert, Button, Card } from "@/components/ui";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

type SessionInfo = {
  available: boolean;
  token?: string;
  wsUrl?: string;
  unixUser?: string;
  domain?: string;
  error?: string;
};

function resolveWsUrl(session: SessionInfo): string | null {
  if (session.token && typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const q = new URLSearchParams({ token: session.token });
    return `${proto}//${window.location.host}/ws/domain-terminal?${q.toString()}`;
  }
  return session.wsUrl ?? null;
}

export function DomainTerminal({
  domain,
  fetchUrl,
}: {
  domain: string;
  fetchUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const connect = useCallback(
    async (session: SessionInfo) => {
      const wsUrl = resolveWsUrl(session);
      if (!wsUrl || !containerRef.current) return;
      disconnect();

      const term =
        termRef.current ??
        new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: "#0f1419",
            foreground: "#e6edf3",
            cursor: "#58a6ff",
          },
        });
      termRef.current = term;

      const fit = fitRef.current ?? new FitAddon();
      fitRef.current = fit;
      if (!term.element) {
        term.loadAddon(fit);
        term.open(containerRef.current);
      }
      fit.fit();

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setError("");
        const sendResize = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                t: "resize",
                cols: term.cols,
                rows: term.rows,
              }),
            );
          }
        };
        sendResize();
        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(data);
        });
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") term.write(ev.data);
      };

      ws.onerror = () => {
        setError(
          `WebSocket failed (${wsUrl.replace(/token=[^&]+/, "token=…")}). On the VPS: sudo -u qadbak pm2 list (qadbak-terminal online?), curl -sI http://127.0.0.1:11000/ws/domain-terminal, then sudo bash scripts/install-node-build-deps.sh && sudo -u qadbak bash -c 'cd /opt/qadbak && npm install && npm run build' && sudo bash scripts/pm2-restart-qadbak.sh`,
        );
      };

      ws.onclose = (ev) => {
        setConnected(false);
        if (ev.code !== 1000 && ev.code !== 1005) {
          setError(
            `Terminal closed (code ${ev.code}${ev.reason ? `: ${ev.reason}` : ""}). Check: sudo -u qadbak pm2 logs qadbak-terminal --lines 20`,
          );
        }
        term.writeln("\r\n\r\n[session ended]");
      };
    },
    [disconnect],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    disconnect();
    termRef.current?.dispose();
    termRef.current = null;
    fitRef.current = null;
    try {
      const res = await fetch(fetchUrl, { credentials: "include" });
      const data = (await res.json()) as SessionInfo & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not start terminal.");
      setInfo(data);
      if (!data.available) {
        setError(
          data.error ??
            "Native terminal not available on this server.",
        );
        return;
      }
      await connect(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, [connect, disconnect, fetchUrl]);

  useEffect(() => {
    void load();
    return () => {
      disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect only when domain changes
  }, [domain, fetchUrl]);

  useEffect(() => {
    const onResize = () => fitRef.current?.fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const userLabel = info?.unixUser ?? domain;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white">Domain shell</h2>
          <p className="mt-1 text-sm text-panel-muted">
            Native bash as <code className="text-white">{userLabel}</code> — no
            Webmin login.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>
            {loading ? "Connecting…" : "New session"}
          </Button>
          {connected && (
            <Button variant="ghost" onClick={disconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      <Card className="overflow-hidden p-0">
        <div
          ref={containerRef}
          className="min-h-[min(75vh,800px)] w-full bg-[#0f1419] p-2"
          aria-label={`Terminal for ${domain}`}
        />
      </Card>
    </div>
  );
}
