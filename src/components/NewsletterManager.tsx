"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
  Textarea,
} from "@/components/ui";
import { useDomainNavReset } from "@/hooks/useDomainNavReset";
import type {
  NewsletterCampaign,
  NewsletterSettings,
  NewsletterSubscriber,
} from "@/lib/newsletter/types";
import { useCallback, useEffect, useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

type Tab = "overview" | "subscribers" | "campaigns" | "signup";

const EMPTY_SETTINGS: NewsletterSettings = {
  enabled: true,
  fromMailbox: "info",
  fromName: "",
  doubleOptIn: true,
  signupEnabled: true,
  listId: "",
  welcomeSubject: "Confirm your subscription",
  welcomeBody:
    "Thanks for subscribing! Click the link below to confirm:\n\n{confirmUrl}",
};

export function NewsletterManager({
  domain,
  initialMailboxes,
  isAdmin,
  initialError,
}: {
  domain: string;
  initialMailboxes: string[];
  isAdmin: boolean;
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [settings, setSettings] = useState<NewsletterSettings>(EMPTY_SETTINGS);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    unsubscribed: 0,
  });
  const [publicUrls, setPublicUrls] = useState({
    subscribe: "",
    confirm: "",
    unsubscribe: "",
  });

  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([]);

  const [subEmail, setSubEmail] = useState("");
  const [subName, setSubName] = useState("");
  const [importCsv, setImportCsv] = useState("");
  const [deleteSub, setDeleteSub] = useState<NewsletterSubscriber | null>(null);
  const [deleteConfirmTyped, setDeleteConfirmTyped] = useState("");

  const [campaignForm, setCampaignForm] = useState<Partial<NewsletterCampaign>>({
    name: "",
    subject: "",
    bodyHtml: "",
    bodyText: "",
  });
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [sendCampaignId, setSendCampaignId] = useState<string | null>(null);
  const [sendConfirmTyped, setSendConfirmTyped] = useState("");

  const loadOverview = useCallback(async () => {
    const res = await fetch(`/api/domains/${enc}/newsletter`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load newsletter.");
    setSettings({ ...EMPTY_SETTINGS, ...(data.settings ?? {}) });
    setStats(
      data.stats ?? { total: 0, active: 0, pending: 0, unsubscribed: 0 },
    );
    setPublicUrls(
      data.publicUrls ?? { subscribe: "", confirm: "", unsubscribe: "" },
    );
  }, [enc]);

  const loadSubscribers = useCallback(async () => {
    const res = await fetch(`/api/domains/${enc}/newsletter/subscribers`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load subscribers.");
    setSubscribers(data.subscribers ?? []);
  }, [enc]);

  const loadCampaigns = useCallback(async () => {
    const res = await fetch(`/api/domains/${enc}/newsletter/campaigns`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load campaigns.");
    setCampaigns(data.campaigns ?? []);
  }, [enc]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadOverview(), loadSubscribers(), loadCampaigns()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, [loadOverview, loadSubscribers, loadCampaigns]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useDomainNavReset(domain, () => {
    setError(initialError);
    setSuccess("");
    setTab("overview");
    void refreshAll();
  });

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSettings({ ...EMPTY_SETTINGS, ...(data.settings ?? settings) });
      setSuccess("Newsletter settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function addSubscriber(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/newsletter/subscribers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: subEmail, name: subName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Add failed.");
      setSubEmail("");
      setSubName("");
      setSuccess("Subscriber added.");
      await loadSubscribers();
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function importSubscribers(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/newsletter/subscribers/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importCsv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setImportCsv("");
      setSuccess(`Imported ${data.added} subscriber(s), skipped ${data.skipped}.`);
      await loadSubscribers();
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function removeSubscriber() {
    if (!deleteSub) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${enc}/newsletter/subscribers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteSub.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setDeleteSub(null);
      await loadSubscribers();
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function saveCampaign(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/newsletter/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...campaignForm,
          id: editingCampaignId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setCampaignForm({ name: "", subject: "", bodyHtml: "", bodyText: "" });
      setEditingCampaignId(null);
      setSuccess("Campaign saved.");
      await loadCampaigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/newsletter/campaigns/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testTo,
          subject: campaignForm.subject,
          bodyHtml: campaignForm.bodyHtml,
          bodyText: campaignForm.bodyText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Test send failed.");
      setSuccess(`Test email sent to ${testTo}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSendCampaign() {
    if (!sendCampaignId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/newsletter/campaigns/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: sendCampaignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed.");
      setSendCampaignId(null);
      setSendConfirmTyped("");
      if (data.remaining > 0) {
        setSuccess(
          `Sending in progress: ${data.sent} sent, ${data.remaining} remaining. Click "Continue sending" on the campaign.`,
        );
      } else {
        setSuccess(`Campaign sent to ${data.sent} recipient(s).`);
      }
      await loadCampaigns();
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function continueSending(campaignId: string) {
    setLoading(true);
    setError("");
    try {
      let remaining = 1;
      let rounds = 0;
      while (remaining > 0 && rounds < 10) {
        const res = await fetch(`/api/domains/${enc}/newsletter/campaigns/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ max: 50 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Process failed.");
        remaining = data.remaining ?? 0;
        rounds++;
        if (data.done) break;
      }
      setSuccess(remaining === 0 ? "Campaign delivery completed." : "Batch processed — more remaining.");
      await loadCampaigns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  function statusBadge(status: string) {
    if (status === "active") return <Badge tone="success">Active</Badge>;
    if (status === "pending") return <Badge tone="warning">Pending</Badge>;
    if (status === "unsubscribed") return <Badge tone="danger">Unsubscribed</Badge>;
    if (status === "sent") return <Badge tone="success">Sent</Badge>;
    if (status === "sending") return <Badge tone="warning">Sending</Badge>;
    if (status === "failed") return <Badge tone="danger">Failed</Badge>;
    return <Badge>{status}</Badge>;
  }

  const embedSnippet = `<!-- Qadbak newsletter signup -->
<form id="qb-newsletter" style="max-width:24rem">
  <input type="email" name="email" placeholder="Your email" required style="width:100%;padding:0.5rem;margin-bottom:0.5rem"/>
  <input type="text" name="name" placeholder="Name (optional)" style="width:100%;padding:0.5rem;margin-bottom:0.5rem"/>
  <button type="submit" style="padding:0.5rem 1rem">Subscribe</button>
  <p id="qb-newsletter-msg" style="font-size:0.875rem;margin-top:0.5rem"></p>
</form>
<script>
document.getElementById("qb-newsletter").addEventListener("submit", async function(e) {
  e.preventDefault();
  var fd = new FormData(e.target);
  var msg = document.getElementById("qb-newsletter-msg");
  msg.textContent = "Sending…";
  try {
    var res = await fetch("${publicUrls.subscribe || `/api/newsletter/subscribe`}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: "${domain}",
        listId: "${settings.listId}",
        email: fd.get("email"),
        name: fd.get("name") || ""
      })
    });
    var data = await res.json();
    msg.textContent = res.ok ? (data.message || "Thank you!") : (data.error || "Error");
  } catch (err) {
    msg.textContent = "Network error.";
  }
});
</script>`;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "subscribers", label: "Subscribers" },
    { id: "campaigns", label: "Campaigns" },
    { id: "signup", label: "Signup form" },
  ];

  return (
    <div className="space-y-6">
      <DomainPageHeader
        domain={domain}
        title="Newsletter"
        description={
          isAdmin
            ? "Send newsletters to your customers — admin can assist when needed"
            : "Send newsletters to your customers"
        }
      />

      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <nav className="flex flex-wrap gap-2 border-b border-panel-border pb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-panel-accent/20 text-white"
                : "text-panel-muted hover:bg-panel-card hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm text-panel-muted">Total</p>
            <p className="mt-1 text-2xl font-semibold text-white">{stats.total}</p>
          </Card>
          <Card>
            <p className="text-sm text-panel-muted">Active</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{stats.active}</p>
          </Card>
          <Card>
            <p className="text-sm text-panel-muted">Pending confirm</p>
            <p className="mt-1 text-2xl font-semibold text-amber-300">{stats.pending}</p>
          </Card>
          <Card>
            <p className="text-sm text-panel-muted">Unsubscribed</p>
            <p className="mt-1 text-2xl font-semibold text-red-300">{stats.unsubscribed}</p>
          </Card>
        </div>
      )}

      {tab === "overview" && (
        <Card>
          <form onSubmit={saveSettings} className="space-y-4">
            <h2 className="text-lg font-medium text-white">Settings</h2>
            <label className="flex items-center gap-2 text-sm text-panel-muted">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              Newsletter enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-panel-muted">
              <input
                type="checkbox"
                checked={settings.signupEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, signupEnabled: e.target.checked })
                }
              />
              Public signup form allowed
            </label>
            <label className="flex items-center gap-2 text-sm text-panel-muted">
              <input
                type="checkbox"
                checked={settings.doubleOptIn}
                onChange={(e) =>
                  setSettings({ ...settings, doubleOptIn: e.target.checked })
                }
              />
              Double opt-in (confirmation email required)
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>From mailbox</Label>
                <select
                  className="qadbak-field mt-1 w-full"
                  value={settings.fromMailbox}
                  onChange={(e) =>
                    setSettings({ ...settings, fromMailbox: e.target.value })
                  }
                >
                  {initialMailboxes.length === 0 && (
                    <option value={settings.fromMailbox}>{settings.fromMailbox}</option>
                  )}
                  {initialMailboxes.map((m) => (
                    <option key={m} value={m}>
                      {m}@{domain}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>From name (optional)</Label>
                <Input
                  value={settings.fromName}
                  onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
                  placeholder="Your company"
                />
              </div>
            </div>
            {settings.doubleOptIn && (
              <>
                <div>
                  <Label>Confirmation email subject</Label>
                  <Input
                    value={settings.welcomeSubject}
                    onChange={(e) =>
                      setSettings({ ...settings, welcomeSubject: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Confirmation email body</Label>
                  <Textarea
                    rows={4}
                    value={settings.welcomeBody}
                    onChange={(e) =>
                      setSettings({ ...settings, welcomeBody: e.target.value })
                    }
                  />
                  <p className="mt-1 text-xs text-panel-muted">
                    Use {"{confirmUrl}"}, {"{name}"}, {"{email}"} as placeholders.
                  </p>
                </div>
              </>
            )}
            <Button type="submit" disabled={loading}>
              Save settings
            </Button>
          </form>
        </Card>
      )}

      {tab === "subscribers" && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-medium text-white">Add subscriber</h2>
            <form onSubmit={addSubscriber} className="mt-4 flex flex-wrap gap-3">
              <Input
                type="email"
                placeholder="email@example.com"
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                required
              />
              <Input
                placeholder="Name (optional)"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
              />
              <Button type="submit" disabled={loading}>
                Add
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-medium text-white">Import CSV</h2>
            <p className="mt-1 text-sm text-panel-muted">
              One address per line: <code>email,name</code> (header row optional)
            </p>
            <form onSubmit={importSubscribers} className="mt-4 space-y-3">
              <Textarea
                rows={6}
                placeholder="email@example.com,John Doe"
                value={importCsv}
                onChange={(e) => setImportCsv(e.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={loading || !importCsv.trim()}>
                Import
              </Button>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-panel-border bg-panel-bg/50 text-panel-muted">
                <tr>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Source</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => (
                  <tr key={s.id} className="border-b border-panel-border/50">
                    <td className="px-6 py-4 text-white">{s.email}</td>
                    <td className="px-6 py-4 text-panel-muted">{s.name || "—"}</td>
                    <td className="px-6 py-4">{statusBadge(s.status)}</td>
                    <td className="px-6 py-4 text-panel-muted">{s.source}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="danger"
                        onClick={() => {
                          setDeleteSub(s);
                          setDeleteConfirmTyped("");
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {subscribers.length === 0 && (
              <p className="px-6 py-8 text-center text-panel-muted">No subscribers yet.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-medium text-white">
              {editingCampaignId ? "Edit campaign" : "New campaign"}
            </h2>
            <form onSubmit={saveCampaign} className="mt-4 space-y-4">
              <div>
                <Label>Campaign name</Label>
                <Input
                  value={campaignForm.name ?? ""}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Subject</Label>
                <Input
                  value={campaignForm.subject ?? ""}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, subject: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>HTML body</Label>
                <Textarea
                  rows={8}
                  value={campaignForm.bodyHtml ?? ""}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, bodyHtml: e.target.value })
                  }
                  placeholder="<p>Hello!</p>"
                />
              </div>
              <div>
                <Label>Plain text (fallback)</Label>
                <Textarea
                  rows={5}
                  value={campaignForm.bodyText ?? ""}
                  onChange={(e) =>
                    setCampaignForm({ ...campaignForm, bodyText: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[12rem] flex-1">
                  <Label>Test recipient</Label>
                  <Input
                    type="email"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || !testTo}
                  onClick={() => void sendTest()}
                >
                  Send test
                </Button>
                <Button type="submit" disabled={loading}>
                  Save draft
                </Button>
                {editingCampaignId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingCampaignId(null);
                      setCampaignForm({
                        name: "",
                        subject: "",
                        bodyHtml: "",
                        bodyText: "",
                      });
                    }}
                  >
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-panel-border bg-panel-bg/50 text-panel-muted">
                <tr>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Stats</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-panel-border/50">
                    <td className="px-6 py-4 text-white">{c.name}</td>
                    <td className="px-6 py-4 text-panel-muted">{c.subject}</td>
                    <td className="px-6 py-4">{statusBadge(c.status)}</td>
                    <td className="px-6 py-4 text-panel-muted tabular-nums">
                      {c.stats
                        ? `${c.stats.sent}/${c.stats.total} sent`
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {c.status === "draft" && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditingCampaignId(c.id);
                              setCampaignForm(c);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => {
                              setSendCampaignId(c.id);
                              setSendConfirmTyped("");
                            }}
                          >
                            Send
                          </Button>
                        </>
                      )}
                      {c.status === "sending" && (
                        <Button
                          variant="secondary"
                          onClick={() => void continueSending(c.id)}
                        >
                          Continue sending
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {campaigns.length === 0 && (
              <p className="px-6 py-8 text-center text-panel-muted">No campaigns yet.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "signup" && (
        <Card className="space-y-4">
          <h2 className="text-lg font-medium text-white">Website signup form</h2>
          <p className="text-sm text-panel-muted">
            Paste this HTML on your website (e.g. WordPress custom HTML block). Subscribers
            only count after double opt-in confirmation when that option is enabled.
          </p>
          <p className="text-xs text-panel-muted">
            List ID: <code className="text-white">{settings.listId || "—"}</code>
          </p>
          <pre className="overflow-x-auto rounded-lg border border-panel-border bg-panel-bg p-4 text-xs text-slate-300">
            {embedSnippet}
          </pre>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(embedSnippet);
              setSuccess("Embed code copied to clipboard.");
            }}
          >
            Copy embed code
          </Button>
        </Card>
      )}

      {deleteSub && (
        <ConfirmDialog
          open
          title="Remove subscriber"
          description={`Remove ${deleteSub.email} from the list?`}
          confirmLabel="Remove"
          confirmValue={deleteSub.email}
          typedValue={deleteConfirmTyped}
          onTypedChange={setDeleteConfirmTyped}
          onConfirm={() => void removeSubscriber()}
          onCancel={() => {
            setDeleteSub(null);
            setDeleteConfirmTyped("");
          }}
          loading={loading}
        />
      )}

      {sendCampaignId && (
        <ConfirmDialog
          open
          title="Send newsletter"
          description={`Send this campaign to ${stats.active} active subscriber(s)? This cannot be undone.`}
          confirmLabel="Send now"
          confirmValue="SEND"
          typedValue={sendConfirmTyped}
          onTypedChange={setSendConfirmTyped}
          onConfirm={() => void confirmSendCampaign()}
          onCancel={() => {
            setSendCampaignId(null);
            setSendConfirmTyped("");
          }}
          loading={loading}
        />
      )}
    </div>
  );
}
