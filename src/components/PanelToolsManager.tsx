"use client";

import { Alert, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { useDomainNavReset } from "@/hooks/useDomainNavReset";
import { useCallback, useEffect, useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";
import { MiniBarChart } from "./MiniBarChart";

type SectionId = "deliverability" | "website" | "staging" | "support";

export function PanelToolsManager({
  domain,
  initialMailboxes,
  isAdmin,
}: {
  domain: string;
  initialMailboxes: string[];
  isAdmin: boolean;
}) {
  const enc = encodeURIComponent(domain);
  const [section, setSection] = useState<SectionId>("deliverability");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown>>({});

  const [dmarcPolicy, setDmarcPolicy] = useState("none");
  const [dmarcRua, setDmarcRua] = useState("");
  const [autoUser, setAutoUser] = useState(initialMailboxes[0] ?? "info");
  const [autoBody, setAutoBody] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [gitSecret, setGitSecret] = useState("");
  const [bounceEmail, setBounceEmail] = useState("");
  const [ciCmd, setCiCmd] = useState("npm run build");
  const [maintMsg, setMaintMsg] = useState("We'll be back soon.");
  const [sshKey, setSshKey] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [invoiceDesc, setInvoiceDesc] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [tplName, setTplName] = useState("");
  const [tplSubject, setTplSubject] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [segName, setSegName] = useState("");
  const [segFilter, setSegFilter] = useState("active");

  const call = useCallback(
    async (action: string, payload?: Record<string, unknown>) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/domains/${enc}/tools`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, payload }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? action);
        setData((d) => ({ ...d, [action]: json }));
        return json;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error.");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [enc],
  );

  const loadSection = useCallback(async () => {
    try {
      if (section === "deliverability") {
        await Promise.all([
          call("dmarc-get"),
          call("deliverability-dashboard"),
          call("mailbox-autoreply-list"),
          call("mail-bounces-list"),
          call("bounce-suppress-list"),
          call("newsletter-stats-get"),
          call("newsletter-templates-list"),
          call("newsletter-segments-list"),
        ]);
      } else if (section === "website") {
        await Promise.all([
          call("analytics-summary"),
          call("analytics-history"),
          call("git-deploy-get"),
          call("git-deploy-log"),
          call("wp-toolkit-status"),
          call("wp-toolkit-security"),
          call("woocommerce-status"),
          call("maintenance-get"),
          call("contact-form-get"),
          call("contact-form-embed"),
          call("seo-404-scan"),
          call("ci-pipeline-get"),
        ]);
      } else if (section === "staging") {
        await Promise.all([
          call("staging-get"),
          call("bandwidth-usage"),
          call("bandwidth-traffic"),
          call("redis-get"),
          call("memcached-get"),
          call("ssh-keys-list"),
          call("awstats-config"),
        ]);
      } else {
        await Promise.all([
          call("tickets-list"),
          call("billing-invoices-list"),
          call("carddav-status"),
          call("carddav-export-vcf"),
        ]);
      }
    } catch {
      /* error set in call */
    }
  }, [section, call]);

  useEffect(() => {
    void loadSection();
  }, [loadSection]);

  useDomainNavReset(domain, () => {
    setError("");
    setSuccess("");
    void loadSection();
  });

  async function saveDmarc() {
    await call("dmarc-set", { policy: dmarcPolicy, rua: dmarcRua, applyDns: true });
    setSuccess("DMARC settings saved.");
    await call("dmarc-get");
  }

  const sections: { id: SectionId; label: string }[] = [
    { id: "deliverability", label: "Deliverability" },
    { id: "website", label: "Website" },
    { id: "staging", label: "Staging & access" },
    { id: "support", label: "Support & billing" },
  ];

  const dmarc = data["dmarc-get"] as {
    suggestedRecord?: string;
    settings?: { policy?: string; rua?: string };
  };
  const analytics = data["analytics-summary"] as {
    hits?: number;
    topPages?: { path: string; count: number }[];
  };
  const gitCfg = data["git-deploy-get"] as {
    config?: { repoUrl?: string; branch?: string; webhookSecret?: string };
  };
  const wp = data["wp-toolkit-status"] as { installed?: boolean; version?: string };
  const bandwidth = data["bandwidth-usage"] as { diskBytes?: number; history?: { at: string; bytes: number }[] };
  const tickets = data["tickets-list"] as { tickets?: { id: string; subject: string; status: string }[] };
  const invoices = data["billing-invoices-list"] as {
    invoices?: { id: string; description: string; amount: number; status: string }[];
  };
  const contactCfg = data["contact-form-get"] as { config?: { listId?: string } };
  const deliverability = data["deliverability-dashboard"] as {
    score?: number;
    grade?: string;
    spf?: boolean;
    dkim?: boolean;
    dmarc?: string;
  };
  const analyticsHist = data["analytics-history"] as {
    points?: { at: string; hits: number }[];
  };
  const traffic = data["bandwidth-traffic"] as {
    bytes?: number;
    points?: { at: string; bytes: number }[];
  };
  const embed = data["contact-form-embed"] as { snippet?: string };
  const seo404 = data["seo-404-scan"] as { notFound?: { path: string; count: number }[] };

  return (
    <div className="space-y-6">
      <DomainPageHeader
        domain={domain}
        title="Site tools"
        description={
          isAdmin
            ? "Marketing, deployments, staging, and support tools for this domain"
            : "Tools to grow and manage your website"
        }
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <nav className="flex flex-wrap gap-2 border-b border-panel-border pb-3">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSection(s.id);
              setTimeout(() => void loadSection(), 0);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              section === s.id
                ? "bg-panel-accent/20 text-white"
                : "text-panel-muted hover:bg-panel-card hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
        <Button variant="secondary" onClick={() => void loadSection()} disabled={loading}>
          Refresh
        </Button>
      </nav>

      {section === "deliverability" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-medium text-white">Deliverability score</h2>
            <p className="mt-2 text-3xl font-semibold text-white">
              {deliverability?.grade ?? " - "}{" "}
              <span className="text-base text-panel-muted">
                ({deliverability?.score ?? 0}/100)
              </span>
            </p>
            <p className="mt-1 text-sm text-panel-muted">
              SPF {deliverability?.spf ? "✓" : "✗"} · DKIM {deliverability?.dkim ? "✓" : "✗"} ·
              DMARC {deliverability?.dmarc ?? " - "}
            </p>
          </Card>
          <Card>
            <h2 className="font-medium text-white">DMARC wizard</h2>
            <p className="mt-1 text-sm text-panel-muted">{dmarc?.suggestedRecord}</p>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Policy</Label>
                <select
                  className="qadbak-field mt-1 w-full"
                  value={dmarcPolicy}
                  onChange={(e) => setDmarcPolicy(e.target.value)}
                >
                  <option value="none">none (monitor)</option>
                  <option value="quarantine">quarantine</option>
                  <option value="reject">reject</option>
                </select>
              </div>
              <Input
                placeholder="rua email (optional)"
                value={dmarcRua}
                onChange={(e) => setDmarcRua(e.target.value)}
              />
              <Button onClick={() => void saveDmarc()} disabled={loading}>
                Save DMARC
              </Button>
            </div>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Mailbox autoresponder</h2>
            <div className="mt-3 space-y-2">
              <select
                className="qadbak-field w-full"
                value={autoUser}
                onChange={(e) => setAutoUser(e.target.value)}
              >
                {initialMailboxes.map((m) => (
                  <option key={m} value={m}>
                    {m}@{domain}
                  </option>
                ))}
              </select>
              <Textarea
                rows={3}
                placeholder="Out of office message"
                value={autoBody}
                onChange={(e) => setAutoBody(e.target.value)}
              />
              <Button
                onClick={async () => {
                  await call("mailbox-autoreply-set", {
                    user: autoUser,
                    enabled: true,
                    body: autoBody,
                  });
                  setSuccess("Autoresponder saved.");
                }}
                disabled={loading}
              >
                Enable autoresponder
              </Button>
            </div>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Mail bounces</h2>
            <pre className="mt-2 max-h-40 overflow-auto text-xs text-slate-400">
              {JSON.stringify(
                (data["mail-bounces-list"] as { bounces?: unknown[] })?.bounces?.slice(0, 5),
                null,
                2,
              )}
            </pre>
            <Input
              className="mt-2"
              placeholder="Suppress email"
              value={bounceEmail}
              onChange={(e) => setBounceEmail(e.target.value)}
            />
            <Button
              className="mt-2"
              variant="secondary"
              disabled={loading || !bounceEmail}
              onClick={async () => {
                await call("bounce-suppress-add", { email: bounceEmail });
                setBounceEmail("");
                setSuccess("Address suppressed and unsubscribed.");
                await call("bounce-suppress-list");
              }}
            >
              Suppress address
            </Button>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Newsletter stats</h2>
            <p className="mt-2 text-sm text-panel-muted">
              Opens:{" "}
              {(data["newsletter-stats-get"] as { totals?: { opens?: number } })?.totals?.opens ?? 0}{" "}
              · Clicks:{" "}
              {(data["newsletter-stats-get"] as { totals?: { clicks?: number } })?.totals?.clicks ?? 0}
            </p>
            <Button
              className="mt-3"
              variant="secondary"
              disabled={loading}
              onClick={async () => {
                const r = await call("newsletter-gdpr-export");
                const csv = (r as { csv?: string }).csv ?? "";
                void navigator.clipboard.writeText(csv);
                setSuccess("Subscriber export copied (GDPR).");
              }}
            >
              Export subscribers (GDPR)
            </Button>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Newsletter templates</h2>
            <ul className="mt-2 space-y-1 text-xs text-panel-muted">
              {(
                (data["newsletter-templates-list"] as {
                  templates?: { id: string; name: string; subject?: string }[];
                })?.templates ?? []
              ).map((t) => (
                <li key={t.id}>
                  {t.name}
                  {t.subject ? ` - ${t.subject}` : ""}
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-2">
              <Input placeholder="Template name" value={tplName} onChange={(e) => setTplName(e.target.value)} />
              <Input placeholder="Subject" value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} />
              <Textarea
                rows={3}
                placeholder="HTML body"
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={loading || !tplName}
                onClick={async () => {
                  await call("newsletter-template-save", {
                    name: tplName,
                    subject: tplSubject,
                    bodyHtml: tplBody,
                  });
                  setTplName("");
                  setTplSubject("");
                  setTplBody("");
                  setSuccess("Template saved.");
                  await call("newsletter-templates-list");
                }}
              >
                Save template
              </Button>
            </div>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Newsletter segments</h2>
            <ul className="mt-2 space-y-1 text-xs text-panel-muted">
              {(
                (data["newsletter-segments-list"] as {
                  segments?: { id: string; name: string; filter?: string }[];
                })?.segments ?? []
              ).map((s) => (
                <li key={s.id}>
                  {s.name} ({s.filter ?? "active"})
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-2">
              <Input placeholder="Segment name" value={segName} onChange={(e) => setSegName(e.target.value)} />
              <select
                className="qadbak-field w-full"
                value={segFilter}
                onChange={(e) => setSegFilter(e.target.value)}
              >
                <option value="active">Active subscribers</option>
                <option value="all">All subscribers</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
              <Button
                variant="secondary"
                disabled={loading || !segName}
                onClick={async () => {
                  await call("newsletter-segment-save", {
                    name: segName,
                    filter: segFilter,
                  });
                  setSegName("");
                  setSuccess("Segment saved.");
                  await call("newsletter-segments-list");
                }}
              >
                Save segment
              </Button>
            </div>
          </Card>
        </div>
      )}

      {section === "website" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-medium text-white">Website analytics</h2>
            <p className="mt-2 text-sm text-panel-muted">{analytics?.hits ?? 0} hits (log window)</p>
            <MiniBarChart
              className="mt-3"
              points={(analyticsHist?.points ?? []).slice(-7).map((p) => ({
                label: p.at.slice(5),
                value: p.hits,
              }))}
            />
            <ul className="mt-3 text-xs text-slate-400">
              {analytics?.topPages?.slice(0, 5).map((p) => (
                <li key={p.path}>
                  {p.path} ({p.count})
                </li>
              ))}
            </ul>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="font-medium text-white">Git deploy & webhook</h2>
            <Input
              className="mt-2"
              placeholder="https://github.com/user/repo.git"
              value={gitUrl || gitCfg?.config?.repoUrl || ""}
              onChange={(e) => setGitUrl(e.target.value)}
            />
            <Input
              className="mt-2"
              placeholder="branch"
              value={gitBranch || gitCfg?.config?.branch || "main"}
              onChange={(e) => setGitBranch(e.target.value)}
            />
            <Input
              className="mt-2"
              placeholder="Webhook secret"
              type="password"
              value={gitSecret || gitCfg?.config?.webhookSecret || ""}
              onChange={(e) => setGitSecret(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  await call("git-deploy-set", {
                    repoUrl: gitUrl,
                    branch: gitBranch,
                    webhookSecret: gitSecret,
                  });
                  setSuccess("Git config saved.");
                }}
                disabled={loading}
              >
                Save
              </Button>
              <Button
                onClick={async () => {
                  await call("git-deploy-run");
                  setSuccess("Deploy finished.");
                }}
                disabled={loading}
              >
                Deploy now
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await call("git-deploy-rollback");
                  setSuccess("Rolled back one commit.");
                }}
                disabled={loading}
              >
                Rollback
              </Button>
            </div>
            <p className="mt-2 text-xs text-panel-muted">
              Webhook URL:{" "}
              <code className="text-white">
                POST /api/domains/{domain}/git-webhook
              </code>
              {" · "}
              Header <code className="text-white">X-Qadbak-Deploy-Secret</code>
              {gitCfg?.config?.webhookSecret ? (
                <span className="text-emerald-400"> · secret configured</span>
              ) : (
                <span className="text-amber-400"> · no secret yet</span>
              )}
            </p>
            <div className="mt-3 max-h-32 overflow-auto rounded border border-panel-border/60 bg-panel-bg/40 p-2 font-mono text-xs text-slate-400">
              {(
                (data["git-deploy-log"] as { log?: { at: string; action: string }[] })?.log ?? []
              )
                .slice(-5)
                .map((e) => (
                  <div key={e.at}>
                    {e.at}: {e.action}
                  </div>
                ))}
            </div>
          </Card>
          <Card>
            <h2 className="font-medium text-white">WordPress toolkit</h2>
            <p className="mt-2 text-sm text-panel-muted">
              {wp?.installed
                ? `WordPress ${wp.version ?? ""} in public_html`
                : "WordPress not detected"}
            </p>
            {(data["wp-toolkit-security"] as { issues?: string[] })?.issues?.length ? (
              <ul className="mt-2 text-xs text-amber-400">
                {(data["wp-toolkit-security"] as { issues: string[] }).issues.slice(0, 5).map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : null}
            {wp?.installed && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    await call("wp-toolkit-backup");
                    setSuccess("Backup started.");
                  }}
                  disabled={loading}
                  variant="secondary"
                >
                  Backup first
                </Button>
                <Button
                  onClick={async () => {
                    await call("wp-toolkit-update");
                    setSuccess("WordPress core update ran.");
                    await call("wp-toolkit-status");
                  }}
                  disabled={loading}
                >
                  Update core
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    await call("wp-toolkit-plugins");
                    setSuccess("Plugins updated.");
                  }}
                  disabled={loading}
                >
                  Update plugins
                </Button>
              </div>
            )}
          </Card>
          <Card>
            <h2 className="font-medium text-white">Maintenance mode</h2>
            <Textarea
              className="mt-2"
              rows={2}
              value={maintMsg}
              onChange={(e) => setMaintMsg(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <Button
                onClick={async () => {
                  await call("maintenance-set", { enabled: true, message: maintMsg });
                  setSuccess("Maintenance mode on.");
                }}
                disabled={loading}
              >
                Enable
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await call("maintenance-set", { enabled: false });
                  setSuccess("Maintenance mode off.");
                }}
                disabled={loading}
              >
                Disable
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await call("maintenance-nginx", { enabled: true, message: maintMsg });
                  setSuccess("Nginx maintenance snippet applied.");
                }}
                disabled={loading}
              >
                Nginx maintenance
              </Button>
            </div>
          </Card>
          <Card>
            <h2 className="font-medium text-white">WooCommerce</h2>
            <p className="mt-2 text-sm text-panel-muted">
              {(data["woocommerce-status"] as { installed?: boolean; version?: string })?.installed
                ? `WooCommerce ${(data["woocommerce-status"] as { version?: string }).version ?? ""}`
                : "Not detected"}
            </p>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Deploy pipeline</h2>
            <Input
              className="mt-2 font-mono text-xs"
              value={ciCmd}
              onChange={(e) => setCiCmd(e.target.value)}
            />
            <div className="mt-2 flex gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  await call("ci-pipeline-set", { command: ciCmd });
                  setSuccess("Pipeline command saved.");
                }}
                disabled={loading}
              >
                Save
              </Button>
              <Button
                onClick={async () => {
                  await call("ci-pipeline-run");
                  setSuccess("Pipeline finished.");
                }}
                disabled={loading}
              >
                Run
              </Button>
            </div>
          </Card>
          <Card>
            <h2 className="font-medium text-white">404 monitor</h2>
            <ul className="mt-2 text-xs text-slate-400">
              {seo404?.notFound?.slice(0, 8).map((p) => (
                <li key={p.path}>
                  {p.path} ({p.count})
                </li>
              ))}
            </ul>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="font-medium text-white">Contact form</h2>
            <p className="mt-1 text-sm text-panel-muted">
              List ID: <code>{contactCfg?.config?.listId}</code>
            </p>
            {embed?.snippet && (
              <Button
                className="mt-2"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(embed.snippet ?? "");
                  setSuccess("Contact form embed copied.");
                }}
              >
                Copy embed code
              </Button>
            )}
          </Card>
        </div>
      )}

      {section === "staging" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-medium text-white">Staging</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  await call("staging-sync");
                  setSuccess("Staging copy synced from public_html.");
                }}
                disabled={loading}
              >
                Sync to staging
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await call("staging-vhost");
                  setSuccess("Staging subdomain configured.");
                }}
                disabled={loading}
              >
                Enable staging URL
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await call("staging-promote");
                  setSuccess("Staging promoted to live site.");
                }}
                disabled={loading}
              >
                Promote to live
              </Button>
            </div>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Disk & traffic</h2>
            <p className="mt-2 text-sm text-panel-muted">
              Disk: {Math.round((bandwidth?.diskBytes ?? 0) / 1024 / 1024)} MB · Traffic:{" "}
              {Math.round((traffic?.bytes ?? 0) / 1024 / 1024)} MB (logs)
            </p>
            <MiniBarChart
              className="mt-3"
              points={(traffic?.points ?? bandwidth?.history ?? []).slice(-7).map((p) => ({
                label: String(p.at).slice(5),
                value: Math.round(("bytes" in p ? p.bytes : 0) / 1024 / 1024),
              }))}
            />
          </Card>
          <Card>
            <h2 className="font-medium text-white">Subdomain</h2>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={async () => {
                await call("subdomain-add", { sub: "shop" });
                setSuccess("Subdomain shop created.");
              }}
              disabled={loading}
            >
              Add shop.{domain}
            </Button>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Redis prefix</h2>
            <Button
              className="mt-3"
              onClick={async () => {
                await call("redis-set", { enabled: true });
                setSuccess("Redis config saved (shared 127.0.0.1:6379).");
              }}
              disabled={loading}
            >
              Enable Redis config
            </Button>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Memcached</h2>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={async () => {
                await call("memcached-set", { enabled: true });
                setSuccess("Memcached prefix saved (shared 127.0.0.1:11211).");
              }}
              disabled={loading}
            >
              Enable Memcached config
            </Button>
          </Card>
          <Card>
            <h2 className="font-medium text-white">MongoDB database</h2>
            <Button
              className="mt-3"
              variant="secondary"
              onClick={async () => {
                const r = await call("mongo-create", { name: "app" });
                setSuccess(`Mongo DB created. Password in response.`);
                void r;
              }}
              disabled={loading}
            >
              Create app database
            </Button>
          </Card>
          <Card>
            <h2 className="font-medium text-white">SSH keys</h2>
            <Textarea
              className="mt-2 font-mono text-xs"
              rows={2}
              placeholder="ssh-ed25519 AAAA..."
              value={sshKey}
              onChange={(e) => setSshKey(e.target.value)}
            />
            <Button
              className="mt-2"
              onClick={async () => {
                await call("ssh-keys-add", { publicKey: sshKey });
                setSshKey("");
                setSuccess("SSH key added.");
                await call("ssh-keys-list");
              }}
              disabled={loading || !sshKey}
            >
              Add key
            </Button>
          </Card>
          <Card>
            <h2 className="font-medium text-white">AWStats</h2>
            <p className="mt-2 text-xs text-panel-muted">
              Config snippet stored when enabled. Install awstats package on server.
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                variant="secondary"
                onClick={() => void call("awstats-config")}
                disabled={loading}
              >
                Generate config
              </Button>
              <Button
                onClick={async () => {
                  await call("awstats-run");
                  setSuccess("AWStats report run.");
                }}
                disabled={loading}
              >
                Run report
              </Button>
            </div>
          </Card>
        </div>
      )}

      {section === "support" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-medium text-white">Support tickets</h2>
            <Input
              className="mt-2"
              placeholder="Subject"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
            />
            <Textarea
              className="mt-2"
              rows={3}
              value={ticketBody}
              onChange={(e) => setTicketBody(e.target.value)}
            />
            <Button
              className="mt-2"
              onClick={async () => {
                await call("tickets-create", {
                  subject: ticketSubject,
                  body: ticketBody,
                  email: contactEmail,
                });
                setTicketSubject("");
                setTicketBody("");
                setSuccess("Ticket created.");
                await call("tickets-list");
              }}
              disabled={loading}
            >
              Create ticket
            </Button>
            <ul className="mt-3 space-y-2 text-sm text-panel-muted">
              {tickets?.tickets?.slice(0, 5).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {t.subject} - {t.status}
                  </span>
                  {t.status === "open" && (
                    <Button
                      variant="secondary"
                      className="!py-0.5 !text-xs"
                      onClick={async () => {
                        await call("ticket-notify", {
                          mailbox: "info",
                          subject: t.subject,
                          body: `New support ticket: ${t.subject}`,
                        });
                        setSuccess("Notification email sent to info@" + domain);
                      }}
                      disabled={loading}
                    >
                      Notify mailbox
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Invoices & payments</h2>
            <Input
              className="mt-2"
              placeholder="Description"
              value={invoiceDesc}
              onChange={(e) => setInvoiceDesc(e.target.value)}
            />
            <Input
              className="mt-2"
              placeholder="Amount EUR"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
            />
            <Button
              className="mt-2"
              onClick={async () => {
                await call("billing-invoice-create", {
                  description: invoiceDesc,
                  amount: parseFloat(invoiceAmount),
                });
                setSuccess("Invoice draft created.");
                await call("billing-invoices-list");
              }}
              disabled={loading}
            >
              Create invoice
            </Button>
            <ul className="mt-3 space-y-2 text-sm text-panel-muted">
              {invoices?.invoices?.slice(0, 5).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    {i.description} - €{i.amount} ({i.status})
                  </span>
                  <Button
                    variant="secondary"
                    className="!py-0.5 !text-xs"
                    onClick={async () => {
                      const r = await call("invoice-pdf-generate", { invoiceId: i.id });
                      const html = (r as { html?: string }).html ?? "";
                      const w = window.open("", "_blank");
                      if (w) {
                        w.document.write(html);
                        w.document.close();
                      }
                      setSuccess("Invoice PDF opened - use Print → Save as PDF.");
                    }}
                    disabled={loading}
                  >
                    PDF
                  </Button>
                  <Button
                    variant="secondary"
                    className="!py-0.5 !text-xs"
                    onClick={async () => {
                      const r = await call("invoice-payment-link", { invoiceId: i.id });
                      const url = (r as { paymentUrl?: string }).paymentUrl;
                      if (url) window.open(url, "_blank");
                      setSuccess("Payment link created.");
                      await call("billing-invoices-list");
                    }}
                    disabled={loading}
                  >
                    Pay link
                  </Button>
                  {i.status === "draft" && (
                    <Button
                      variant="secondary"
                      className="!py-0.5 !text-xs"
                      onClick={async () => {
                        await call("invoice-mark-sent", { invoiceId: i.id });
                        setSuccess("Invoice marked sent - customer can be billed.");
                        await call("billing-invoices-list");
                      }}
                      disabled={loading}
                    >
                      Mark sent
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-medium text-white">CardDAV contacts</h2>
            <Input
              className="mt-2"
              placeholder="email@client.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                onClick={async () => {
                  await call("carddav-contact-upsert", { email: contactEmail, name: "Contact" });
                  setSuccess("Contact saved.");
                  await call("carddav-status");
                }}
                disabled={loading || !contactEmail}
              >
                Save contact
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  const r = await call("carddav-export-vcf");
                  const vcf = (r as { vcf?: string }).vcf ?? "";
                  void navigator.clipboard.writeText(vcf);
                  setSuccess("vCard export copied.");
                }}
                disabled={loading}
              >
                Export vCard
              </Button>
            </div>
          </Card>
          {isAdmin && (
            <Card>
              <h2 className="font-medium text-white">Additional servers</h2>
              <p className="mt-2 text-sm text-panel-muted">
                Register extra servers under Admin → Nodes when you run a multi-server setup.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
