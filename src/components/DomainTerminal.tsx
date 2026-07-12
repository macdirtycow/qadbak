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
  wsProtocols?: string[];
  unixUser?: string;
  shellUser?: string;
  domain?: string;
  error?: string;
};

function resolveWsTarget(
  session: SessionInfo,
  wsPath: string,
): { url: string; protocols: string[] } | null {
  if (!session.token) return null;
  const protocols =
    session.wsProtocols?.length === 2
      ? session.wsProtocols
      : ["qadbak-terminal", session.token];
  if (session.wsUrl) {
    return { url: session.wsUrl, protocols };
  }
  if (typeof window === "undefined") return null;
  const url = new URL(wsPath, window.location.origin);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return { url: url.toString(), protocols };
}

export function DomainTerminal({
  domain = "",
  fetchUrl,
  wsPath = "/ws/domain-terminal",
  title = "Domain shell",
  subtitle,
}: {
  domain?: string;
  fetchUrl: string;
  wsPath?: string;
  title?: string;
  subtitle?: string;
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
      const target = resolveWsTarget(session, wsPath);
      if (!target) return;
      await new Promise<void>((r) => {
        requestAnimationFrame(() => r());
      });
      if (!containerRef.current) {
        setError("Terminal could not mount - try New session.");
        return;
      }
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

      const ws = new WebSocket(target.url, target.protocols);
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
          `WebSocket failed (${target.url}). Check: sudo bash scripts/check-terminal-ws.sh`,
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
    [disconnect, wsPath],
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
        setError(data.error ?? "Native terminal not available on this server.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, fetchUrl, wsPath]);

  useEffect(() => {
    const onResize = () => fitRef.current?.fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const shellLabel =
    (info?.shellUser ?? info?.unixUser?.trim() ?? domain) || "server";
  const description =
    subtitle ??
    (wsPath.includes("admin")
      ? `Full server shell as ${shellLabel} - for Qadbak administrators only.`
      : `Commands run as domain user ${shellLabel} (not root). For server admin use Server terminal.`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white">{title}</h2>
          <p className="mt-1 text-sm text-panel-muted">{description}</p>
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
          aria-label={title}
        />
      </Card>
    </div>
  );
}
