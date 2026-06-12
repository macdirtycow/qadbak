#!/usr/bin/env node
/**
 * Seed demo panel user + showcase domain config (read-only demo).
 * Run on VPS: sudo -u qadbak node scripts/seed-demo-panel.mjs
 */
import bcrypt from "bcryptjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA = path.join(ROOT, "data");
const USERS = path.join(DATA, "users.json");
const DOMAINS = path.join(DATA, "native-domains.json");

const DEMO_USER = process.env.QADBAK_DEMO_USERNAME?.trim() || "demo";
const DEMO_PASS = process.env.QADBAK_DEMO_PASSWORD?.trim() || "DemoView2026!";
const SHOWCASE = (
  process.env.QADBAK_DEMO_SHOWCASE_DOMAIN?.trim() || "showcase.qadbak.com"
).toLowerCase();
const UNIX_USER = SHOWCASE.split(".")[0] || "showcase";

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  await mkdir(DATA, { recursive: true });
  const users = await readJson(USERS, []);
  const hash = await bcrypt.hash(DEMO_PASS, 10);
  const existing = users.find((u) => u.username?.toLowerCase() === DEMO_USER.toLowerCase());
  if (existing) {
    existing.passwordHash = hash;
    existing.role = "admin";
    existing.domains = [];
  } else {
    users.push({
      id: "demo-admin",
      username: DEMO_USER,
      passwordHash: hash,
      role: "admin",
      domains: [],
    });
  }
  await writeFile(USERS, JSON.stringify(users, null, 2));

  const domains = await readJson(DOMAINS, []);
  const existingShowcase = domains.find((d) => d.name === SHOWCASE);
  const showcaseRow = {
    name: SHOWCASE,
    user: UNIX_USER,
    plan: "Demo",
    disabled: false,
    demoOnly: true,
  };
  if (existingShowcase) {
    Object.assign(existingShowcase, showcaseRow);
  } else {
    domains.push(showcaseRow);
  }
  await writeFile(DOMAINS, JSON.stringify(domains, null, 2));

  const cfgDir = path.join(DATA, "domain-config", SHOWCASE);
  await mkdir(cfgDir, { recursive: true });

  const samples = {
    "dmarc-settings.json": { policy: "quarantine", rua: `dmarc@${SHOWCASE}` },
    "git-deploy.json": {
      repoUrl: "https://github.com/macdirtycow/qadbak.git",
      branch: "main",
      webhookSecret: "demo-secret-change-me",
      lastDeploy: new Date().toISOString(),
    },
    "newsletter-tracking.json": { opens: 128, clicks: 34 },
    "newsletter-settings.json": {
      enabled: true,
      fromMailbox: "news",
      fromName: "Showcase Shop",
      doubleOptIn: true,
    },
    "newsletter-subscribers.json": {
      subscribers: [
        {
          id: "sub-1",
          email: "customer@example.com",
          name: "Alex",
          status: "active",
          source: "embed",
          subscribedAt: "2026-01-15T10:00:00.000Z",
          confirmedAt: "2026-01-15T10:05:00.000Z",
        },
      ],
    },
    "newsletter-campaigns.json": {
      campaigns: [
        {
          id: "camp-1",
          name: "Spring sale",
          subject: "20% off this week",
          status: "sent",
          stats: { opens: 42, clicks: 11, sent: 1 },
        },
      ],
    },
    "mailbox-autoreply.json": {
      mailboxes: [{ user: "info", enabled: true, body: "We reply within one business day." }],
    },
    "staging-settings.json": { enabled: true, lastSync: new Date().toISOString() },
    "tickets.json": {
      tickets: [
        {
          id: "t-1",
          subject: "SSL renewal question",
          status: "open",
          createdAt: "2026-02-01T09:00:00.000Z",
        },
      ],
    },
    "billing-invoices.json": {
      invoices: [
        {
          id: "inv-1",
          description: "Hosting Feb 2026",
          amount: 12.5,
          status: "sent",
        },
      ],
    },
    "carddav-contacts.json": {
      contacts: [{ email: "sales@client.com", name: "Sales team" }],
    },
    "contact-form.json": { listId: "cf-demo-1", notifyEmail: `info@${SHOWCASE}` },
    "analytics-history.json": {
      points: [
        { at: "2026-05-20", hits: 120 },
        { at: "2026-05-21", hits: 145 },
        { at: "2026-05-22", hits: 132 },
      ],
    },
    "bandwidth-usage.json": {
      diskBytes: 256 * 1024 * 1024,
      points: [{ at: new Date().toISOString().slice(0, 10), bytes: 48 * 1024 * 1024 }],
    },
  };

  for (const [file, body] of Object.entries(samples)) {
    const p = path.join(cfgDir, file);
    try {
      await readFile(p, "utf8");
    } catch {
      await writeFile(p, JSON.stringify(body, null, 2));
    }
  }

  console.log(
    JSON.stringify({
      ok: true,
      username: DEMO_USER,
      showcase: SHOWCASE,
      hint: `Log in at https://${process.env.QADBAK_DEMO_HOST || "demo.qadbak.com"}/login`,
    }),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
