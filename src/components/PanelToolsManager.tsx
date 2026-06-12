"use client";

import { Alert, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { useDomainNavReset } from "@/hooks/useDomainNavReset";
import { useCallback, useEffect, useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

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
  const [maintMsg, setMaintMsg] = useState("We'll be back soon.");
  const [sshKey, setSshKey] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [invoiceDesc, setInvoiceDesc] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [contactEmail, setContactEmail] = useState("");

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
          call("mailbox-autoreply-list"),
          call("mail-bounces-list"),
          call("newsletter-stats-get"),
        ]);
      } else if (section === "website") {
        await Promise.all([
          call("analytics-summary"),
          call("git-deploy-get"),
          call("wp-toolkit-status"),
          call("maintenance-get"),
          call("contact-form-get"),
        ]);
      } else if (section === "staging") {
        await Promise.all([
          call("staging-get"),
          call("bandwidth-usage"),
          call("redis-get"),
          call("ssh-keys-list"),
          call("awstats-config"),
        ]);
      } else {
        await Promise.all([
          call("tickets-list"),
          call("billing-invoices-list"),
          call("carddav-status"),
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
  const gitCfg = data["git-deploy-get"] as { config?: { repoUrl?: string; branch?: string } };
  const wp = data["wp-toolkit-status"] as { installed?: boolean; version?: string };
  const bandwidth = data["bandwidth-usage"] as { diskBytes?: number; history?: { at: string; bytes: number }[] };
  const tickets = data["tickets-list"] as { tickets?: { id: string; subject: string; status: string }[] };
  const invoices = data["billing-invoices-list"] as {
    invoices?: { id: string; description: string; amount: number; status: string }[];
  };
  const contactCfg = data["contact-form-get"] as { config?: { listId?: string } };

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
          </Card>
          <Card>
            <h2 className="font-medium text-white">Newsletter stats</h2>
            <p className="mt-2 text-sm text-panel-muted">
              Opens:{" "}
              {(data["newsletter-stats-get"] as { totals?: { opens?: number } })?.totals?.opens ?? 0}{" "}
              · Clicks:{" "}
              {(data["newsletter-stats-get"] as { totals?: { clicks?: number } })?.totals?.clicks ?? 0}
            </p>
          </Card>
        </div>
      )}

      {section === "website" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-medium text-white">Website analytics</h2>
            <p className="mt-2 text-sm text-panel-muted">{analytics?.hits ?? 0} hits (log window)</p>
            <ul className="mt-2 text-xs text-slate-400">
              {analytics?.topPages?.slice(0, 5).map((p) => (
                <li key={p.path}>
                  {p.path} ({p.count})
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Git deploy</h2>
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
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  await call("git-deploy-set", { repoUrl: gitUrl, branch: gitBranch });
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
            </div>
          </Card>
          <Card>
            <h2 className="font-medium text-white">WordPress toolkit</h2>
            <p className="mt-2 text-sm text-panel-muted">
              {wp?.installed
                ? `WordPress ${wp.version ?? ""} in public_html`
                : "WordPress not detected"}
            </p>
            {wp?.installed && (
              <Button
                className="mt-3"
                onClick={async () => {
                  await call("wp-toolkit-update");
                  setSuccess("WordPress core update ran.");
                  await call("wp-toolkit-status");
                }}
                disabled={loading}
              >
                Update WordPress core
              </Button>
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
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <h2 className="font-medium text-white">Contact form</h2>
            <p className="mt-1 text-sm text-panel-muted">
              List ID: <code>{contactCfg?.config?.listId}</code> — POST to{" "}
              <code>/api/contact/submit</code>
            </p>
          </Card>
        </div>
      )}

      {section === "staging" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="font-medium text-white">Staging</h2>
            <Button
              className="mt-3"
              onClick={async () => {
                await call("staging-sync");
                setSuccess("Staging copy synced from public_html.");
              }}
              disabled={loading}
            >
              Sync to staging/
            </Button>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Disk / usage</h2>
            <p className="mt-2 text-sm text-panel-muted">
              {Math.round((bandwidth?.diskBytes ?? 0) / 1024 / 1024)} MB home directory
            </p>
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
            <Button
              className="mt-2"
              variant="secondary"
              onClick={() => void call("awstats-config")}
              disabled={loading}
            >
              Generate config
            </Button>
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
            <ul className="mt-3 text-sm text-panel-muted">
              {tickets?.tickets?.slice(0, 5).map((t) => (
                <li key={t.id}>
                  {t.subject} — {t.status}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-medium text-white">Invoices (light)</h2>
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
            <ul className="mt-3 text-sm text-panel-muted">
              {invoices?.invoices?.slice(0, 5).map((i) => (
                <li key={i.id}>
                  {i.description} — €{i.amount} ({i.status})
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
            <Button
              className="mt-2"
              onClick={async () => {
                await call("carddav-contact-upsert", { email: contactEmail, name: "Contact" });
                setSuccess("Contact saved.");
                await call("carddav-status");
              }}
              disabled={loading || !contactEmail}
            >
              Save contact
            </Button>
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
