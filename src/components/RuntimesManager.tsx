"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

type RuntimeApp = {
  type: string;
  name: string;
  port?: number;
  path?: string;
  unit?: string;
};

export function RuntimesManager({
  domain,
  initialRuntimes,
  phpFpmSocket,
  initialError,
  isAdmin,
}: {
  domain: string;
  initialRuntimes: { apps?: RuntimeApp[] };
  phpFpmSocket: string;
  initialError: string;
  isAdmin: boolean;
}) {
  const enc = encodeURIComponent(domain);
  const [runtimes, setRuntimes] = useState(initialRuntimes);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [nodeName, setNodeName] = useState("app");
  const [nodePort, setNodePort] = useState("3000");
  const [pyName, setPyName] = useState("api");
  const [pyPort, setPyPort] = useState("8000");
  const [dockerName, setDockerName] = useState("stack");
  const [dockerLog, setDockerLog] = useState("");

  async function refresh() {
    const res = await fetch(`/api/domains/${enc}/runtimes`);
    const data = await res.json();
    if (res.ok) {
      setRuntimes(data.runtimes ?? { apps: [] });
      setError("");
    }
  }

  async function post(body: Record<string, unknown>) {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/runtimes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setSuccess("Done.");
      await refresh();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      return null;
    } finally {
      setLoading(false);
    }
  }

  const apps = runtimes.apps ?? [];
  const dockerApps = apps.filter((a) => a.type === "docker");

  return (
    <div className="space-y-6">
      <DomainPageHeader
        domain={domain}
        title="Runtimes"
        description="PHP-FPM, Node.js, Python, and Docker"
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">PHP</h2>
        <p className="mt-2 text-sm text-panel-muted">
          Per-directory versions: <strong>PHP</strong> tab. Active FPM socket:{" "}
          <code className="text-panel-link">{phpFpmSocket || "—"}</code>
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Installed apps</h2>
        {apps.length === 0 ? (
          <p className="mt-2 text-sm text-panel-muted">No Node/Python/Docker apps yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-panel-border">
            {apps.map((a) => (
              <li key={`${a.type}-${a.name}`} className="py-3 text-sm flex justify-between gap-4">
                <span>
                  <span className="text-white">{a.type}</span> — {a.name}
                  {a.port != null && ` · port ${a.port}`}
                  {a.path && ` · proxy ${a.path}`}
                </span>
                {isAdmin && a.type === "docker" && (
                  <span className="flex gap-2">
                    <Button
                      variant="ghost"
                      disabled={loading}
                      onClick={async () => {
                        const d = await post({
                          action: "docker-logs",
                          name: a.name,
                        });
                        setDockerLog(String(d?.result?.output ?? ""));
                      }}
                    >
                      Logs
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={loading}
                      onClick={() => post({ action: "docker-start", name: a.name })}
                    >
                      Start
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={loading}
                      onClick={() => post({ action: "docker-stop", name: a.name })}
                    >
                      Stop
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {dockerLog && (
          <pre className="mt-4 max-h-48 overflow-auto text-xs text-panel-muted whitespace-pre-wrap">
            {dockerLog}
          </pre>
        )}
      </Card>

      {isAdmin && (
        <>
          <Card>
            <h2 className="text-lg font-medium text-white">Node.js</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                post({ action: "node", name: nodeName, port: Number(nodePort) || 3000 });
              }}
              className="mt-4 grid gap-4 sm:grid-cols-3"
            >
              <div>
                <Label>Name</Label>
                <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} />
              </div>
              <div>
                <Label>Port</Label>
                <Input value={nodePort} onChange={(e) => setNodePort(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={loading}>
                  Install Node
                </Button>
              </div>
            </form>
          </Card>
          <Card>
            <h2 className="text-lg font-medium text-white">Python (gunicorn)</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                post({ action: "python", name: pyName, port: Number(pyPort) || 8000 });
              }}
              className="mt-4 grid gap-4 sm:grid-cols-3"
            >
              <div>
                <Label>Name</Label>
                <Input value={pyName} onChange={(e) => setPyName(e.target.value)} />
              </div>
              <div>
                <Label>Port</Label>
                <Input value={pyPort} onChange={(e) => setPyPort(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={loading}>
                  Install Python
                </Button>
              </div>
            </form>
          </Card>
          <Card>
            <h2 className="text-lg font-medium text-white">Docker compose</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                post({ action: "docker", name: dockerName });
              }}
              className="mt-4 flex flex-wrap gap-3 items-end"
            >
              <div>
                <Label>Stack name</Label>
                <Input value={dockerName} onChange={(e) => setDockerName(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading}>
                Install Docker stack
              </Button>
            </form>
            {dockerApps.length > 0 && (
              <p className="mt-2 text-xs text-panel-muted">
                Use Start/Stop/Logs on installed Docker rows above.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
