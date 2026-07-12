"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog, Button, Card, Input, Label, PageHeader, Textarea, Alert } from "@/components/ui";
import { Breadcrumbs } from "@/components/Breadcrumbs";

type Tab = "containers" | "images" | "volumes" | "networks" | "compose";

interface DockerSnapshot {
  available: boolean;
  error?: string;
  containers: Array<{
    id: string;
    name: string;
    image: string;
    status: string;
    ports: string;
    created: string;
  }>;
  images: Array<{
    id: string;
    repository: string;
    tag: string;
    size: string;
    created: string;
  }>;
  volumes: Array<{ name: string; driver: string; mountpoint: string }>;
  networks: Array<{ id: string; name: string; driver: string; scope: string }>;
}

const empty: DockerSnapshot = {
  available: false,
  containers: [],
  images: [],
  volumes: [],
  networks: [],
};

export function DockerManager() {
  const [tab, setTab] = useState<Tab>("containers");
  const [data, setData] = useState<DockerSnapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<{ id: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    confirmValue: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");

  const [pullRef, setPullRef] = useState("");
  const [composeProject, setComposeProject] = useState("");
  const [composeYaml, setComposeYaml] = useState("");
  const [composeMessage, setComposeMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/docker");
      const json = (await res.json()) as DockerSnapshot & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load Docker state.");
      setData(json);
      if (json.error) setError(json.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Docker state.");
      setData(empty);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function containerAction(
    id: string,
    action: "start" | "stop" | "restart" | "remove" | "logs",
  ) {
    setBusy(id + action);
    setError(null);
    try {
      const res = await fetch("/api/admin/docker/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, tail: 200 }),
      });
      const json = (await res.json()) as { logs?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Action failed.");
      if (action === "logs") {
        setLogs({ id, text: json.logs ?? "" });
      } else {
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function pullImage() {
    if (!pullRef.trim()) return;
    setBusy("pull");
    setError(null);
    try {
      const res = await fetch("/api/admin/docker/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "image", action: "pull", ref: pullRef.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Pull failed.");
      setPullRef("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pull failed.");
    } finally {
      setBusy(null);
    }
  }

  async function composeAction(action: "validate" | "up" | "down" | "ps") {
    setBusy("compose-" + action);
    setComposeMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/docker/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          project: composeProject.trim() || undefined,
          yaml: composeYaml || undefined,
        }),
      });
      const json = (await res.json()) as {
        message?: string;
        output?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Compose action failed.");
      setComposeMessage(json.message ?? json.output ?? "Done.");
      if (action === "up" || action === "down") await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compose action failed.");
    } finally {
      setBusy(null);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "containers", label: "Containers" },
    { id: "images", label: "Images" },
    { id: "volumes", label: "Volumes" },
    { id: "networks", label: "Networks" },
    { id: "compose", label: "Compose" },
  ];

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Docker" },
        ]}
      />
      <PageHeader
        title="Docker"
        description="Manage containers, images, volumes, and Compose projects on this server. Actions run locally via the Docker CLI and are logged in the activity log."
      />

      {error ? (
        <Alert variant="error" >
          {error}
        </Alert>
      ) : null}

      {!loading && !data.available ? (
        <Card className="mt-4">
          <p className="text-sm text-panel-muted">
            Docker is not available on this host. Install Docker on a Debian-based
            server or enable the Docker service, then refresh this page.
          </p>
          <p className="mt-3 text-xs text-panel-muted">
            See <code className="text-panel-text">docs/DOCKER-ADMIN.md</code> for
            security notes about Docker socket access.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => void refresh()}>
            Refresh
          </Button>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 border-b border-panel-border pb-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  tab === t.id
                    ? "bg-panel-accent/15 font-medium text-panel-text"
                    : "text-panel-muted hover:text-panel-text"
                }`}
              >
                {t.label}
              </button>
            ))}
            <Button
              variant="ghost"
              className="ml-auto px-2 py-1.5"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>

          {tab === "containers" ? (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-panel-border text-panel-muted">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Image</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Ports</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.containers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-panel-muted">
                        No containers found.
                      </td>
                    </tr>
                  ) : (
                    data.containers.map((c) => (
                      <tr key={c.id} className="border-b border-panel-border/50">
                        <td className="py-2 pr-4 font-medium text-panel-text">
                          {c.name}
                        </td>
                        <td className="py-2 pr-4 text-panel-muted">{c.image}</td>
                        <td className="py-2 pr-4">{c.status}</td>
                        <td className="py-2 pr-4 text-xs text-panel-muted">
                          {c.ports || "none"}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {(["start", "stop", "restart", "logs"] as const).map(
                              (a) => (
                                <Button
                                  key={a}
                                  variant="ghost"
                                  className="px-2 py-1 text-xs"
                                  disabled={busy === c.id + a}
                                  onClick={() => void containerAction(c.id, a)}
                                >
                                  {a}
                                </Button>
                              ),
                            )}
                            <Button
                              variant="ghost"
                              className="px-2 py-1 text-xs text-red-400"
                              onClick={() =>
                                setConfirm({
                                  title: "Remove container",
                                  description: `This permanently removes ${c.name}. Type the container name to confirm.`,
                                  confirmValue: c.name,
                                  onConfirm: async () => {
                                    await containerAction(c.id, "remove");
                                    setConfirm(null);
                                    setConfirmTyped("");
                                  },
                                })
                              }
                            >
                              remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {logs ? (
                <div className="mt-4 border-t border-panel-border pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium">Logs: {logs.id.slice(0, 12)}</p>
                    <Button variant="ghost" className="px-2 py-1" onClick={() => setLogs(null)}>
                      Close
                    </Button>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-md bg-panel-bg p-3 text-xs text-panel-muted">
                    {logs.text || "(empty)"}
                  </pre>
                </div>
              ) : null}
            </Card>
          ) : null}

          {tab === "images" ? (
            <div className="space-y-4">
              <Card>
                <Label htmlFor="pull-ref">Pull image</Label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="pull-ref"
                    placeholder="nginx:alpine"
                    value={pullRef}
                    onChange={(e) => setPullRef(e.target.value)}
                  />
                  <Button onClick={() => void pullImage()} disabled={busy === "pull"}>
                    Pull
                  </Button>
                </div>
              </Card>
              <Card className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-panel-border text-panel-muted">
                      <th className="py-2">Repository</th>
                      <th className="py-2">Tag</th>
                      <th className="py-2">Size</th>
                      <th className="py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.images.map((img) => (
                      <tr key={img.id} className="border-b border-panel-border/50">
                        <td className="py-2">{img.repository}</td>
                        <td className="py-2">{img.tag}</td>
                        <td className="py-2 text-panel-muted">{img.size}</td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            className="px-2 py-1 text-xs text-red-400"
                            onClick={() =>
                              setConfirm({
                                title: "Remove image",
                                description: `Remove ${img.repository}:${img.tag}? Type REMOVE to confirm.`,
                                confirmValue: "REMOVE",
                                onConfirm: async () => {
                                  setBusy("rm-" + img.id);
                                  try {
                                    const res = await fetch("/api/admin/docker/resources", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        resource: "image",
                                        action: "remove",
                                        id: img.id,
                                      }),
                                    });
                                    const json = (await res.json()) as { error?: string };
                                    if (!res.ok) throw new Error(json.error ?? "Remove failed.");
                                    await refresh();
                                  } catch (e) {
                                    setError(e instanceof Error ? e.message : "Remove failed.");
                                  } finally {
                                    setBusy(null);
                                    setConfirm(null);
                                    setConfirmTyped("");
                                  }
                                },
                              })
                            }
                          >
                            remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          ) : null}

          {tab === "volumes" ? (
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-panel-border text-panel-muted">
                    <th className="py-2">Name</th>
                    <th className="py-2">Driver</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.volumes.map((v) => (
                    <tr key={v.name} className="border-b border-panel-border/50">
                      <td className="py-2">{v.name}</td>
                      <td className="py-2 text-panel-muted">{v.driver}</td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs text-red-400"
                          onClick={() =>
                            setConfirm({
                              title: "Remove volume",
                              description: `Delete volume ${v.name}? Data is lost. Type the volume name to confirm.`,
                              confirmValue: v.name,
                              onConfirm: async () => {
                                setBusy("vol-" + v.name);
                                try {
                                  const res = await fetch("/api/admin/docker/resources", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      resource: "volume",
                                      action: "remove",
                                      name: v.name,
                                    }),
                                  });
                                  const json = (await res.json()) as { error?: string };
                                  if (!res.ok) throw new Error(json.error ?? "Remove failed.");
                                  await refresh();
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : "Remove failed.");
                                } finally {
                                  setBusy(null);
                                  setConfirm(null);
                                  setConfirmTyped("");
                                }
                              },
                            })
                          }
                        >
                          remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}

          {tab === "networks" ? (
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-panel-border text-panel-muted">
                    <th className="py-2">Name</th>
                    <th className="py-2">Driver</th>
                    <th className="py-2">Scope</th>
                  </tr>
                </thead>
                <tbody>
                  {data.networks.map((n) => (
                    <tr key={n.id} className="border-b border-panel-border/50">
                      <td className="py-2">{n.name}</td>
                      <td className="py-2 text-panel-muted">{n.driver}</td>
                      <td className="py-2 text-panel-muted">{n.scope}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}

          {tab === "compose" ? (
            <div className="space-y-4">
              <Card>
                <Label htmlFor="compose-project">Project name</Label>
                <Input
                  id="compose-project"
                  className="mt-1"
                  placeholder="myapp"
                  value={composeProject}
                  onChange={(e) => setComposeProject(e.target.value)}
                />
                <Label htmlFor="compose-yaml">docker-compose.yml</Label>
                <Textarea
                  id="compose-yaml"
                  className="mt-1 min-h-[200px] font-mono text-xs"
                  placeholder={"services:\n  web:\n    image: nginx:alpine\n    ports:\n      - '8080:80'"}
                  value={composeYaml}
                  onChange={(e) => setComposeYaml(e.target.value)}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    onClick={() => void composeAction("validate")}
                  >
                    Validate
                  </Button>
                  <Button disabled={!!busy} onClick={() => void composeAction("up")}>
                    Deploy
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    onClick={() => void composeAction("down")}
                  >
                    Stop project
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!!busy}
                    onClick={() => void composeAction("ps")}
                  >
                    Status
                  </Button>
                </div>
                {composeMessage ? (
                  <pre className="mt-4 whitespace-pre-wrap rounded-md bg-panel-bg p-3 text-xs text-panel-muted">
                    {composeMessage}
                  </pre>
                ) : null}
              </Card>
            </div>
          ) : null}
        </>
      )}

      {confirm ? (
        <ConfirmDialog
          open
          title={confirm.title}
          description={confirm.description}
          confirmLabel="Confirm"
          confirmValue={confirm.confirmValue}
          typedValue={confirmTyped}
          onTypedChange={setConfirmTyped}
          loading={!!busy}
          onCancel={() => {
            setConfirm(null);
            setConfirmTyped("");
          }}
          onConfirm={() => void confirm.onConfirm()}
        />
      ) : null}
    </div>
  );
}
