"use client";

import { Alert, Button, Card } from "@/components/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type DnsHint = { ok: boolean; label: string };

export function ClientOnboardingWizard({
  domain,
  isAdmin,
}: {
  domain: string;
  isAdmin: boolean;
}) {
  const enc = encodeURIComponent(domain);
  const [step, setStep] = useState(0);
  const [dns, setDns] = useState<DnsHint[]>([]);
  const [mailboxes, setMailboxes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, usersRes] = await Promise.all([
        fetch(`/api/domains/${enc}/website-health`),
        fetch(`/api/domains/${enc}/users`),
      ]);
      const health = await healthRes.json();
      const users = await usersRes.json();
      const checklist: DnsHint[] = (health.cloudflare?.dnsChecklist ?? []).map(
        (label: string) => ({ ok: health.publicProbe?.ok === true, label }),
      );
      if (health.validation?.valid) {
        checklist.unshift({ ok: true, label: "DNS zone validates on server" });
      }
      setDns(checklist.slice(0, 5));
      setMailboxes((users.users ?? []).length);
    } catch {
      /* optional */
    } finally {
      setLoading(false);
    }
  }, [enc]);

  useEffect(() => {
    const key = `qadbak-onboard-${domain}`;
    if (localStorage.getItem(key) === "done") setDismissed(true);
    load();
  }, [domain, load]);

  function finish() {
    localStorage.setItem(`qadbak-onboard-${domain}`, "done");
    setDismissed(true);
  }

  if (dismissed || isAdmin) return null;

  const steps = [
    {
      title: "Welcome to your site",
      body: `This short checklist helps you set up ${domain} on Qadbak.`,
    },
    {
      title: "DNS & website",
      body: "Point your domain to this server and verify the site is reachable.",
    },
    {
      title: "First mailbox",
      body: "Create at least one mailbox for email on your domain.",
    },
  ];

  return (
    <Card>
      <h2 className="text-lg font-medium text-white">Getting started</h2>
      <p className="mt-1 text-sm text-panel-muted">
        Step {step + 1} of {steps.length}: {steps[step].title}
      </p>
      <p className="mt-3 text-sm text-white">{steps[step].body}</p>

      {step === 1 && (
        <ul className="mt-4 space-y-2 text-sm text-panel-muted">
          {loading ? (
            <li>Loading DNS checklist…</li>
          ) : (
            dns.map((h) => (
              <li key={h.label}>
                {h.ok ? "✓" : "○"} {h.label}
              </li>
            ))
          )}
          <li>
            <Link href={`/domains/${enc}/dns`} className="text-panel-link hover:underline">
              Open DNS manager →
            </Link>
          </li>
          <li>
            <Link href={`/domains/${enc}/ssl`} className="text-panel-link hover:underline">
              SSL certificates →
            </Link>
          </li>
        </ul>
      )}

      {step === 2 && (
        <div className="mt-4 text-sm text-panel-muted">
          <p>
            Mailboxes:{" "}
            <span className="text-white">{mailboxes}</span>
            {mailboxes === 0 ? " - create your first mailbox to receive email." : " - looks good!"}
          </p>
          <Link
            href={`/domains/${enc}/mail`}
            className="mt-2 inline-block text-panel-link hover:underline"
          >
            Mail accounts →
          </Link>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
        ) : (
          <Button onClick={finish}>Done - hide wizard</Button>
        )}
        <Button variant="secondary" onClick={finish}>
          Skip
        </Button>
      </div>
      <div className="mt-4">
        <Alert variant="info">
          Enable two-factor under Account → Security for extra protection.
        </Alert>
      </div>
    </Card>
  );
}
