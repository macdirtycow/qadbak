import { randomBytes } from "node:crypto";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
} from "./provisioning-common.mjs";

function newId() {
  return randomBytes(8).toString("hex");
}

export async function ticketsList(domain) {
  const data = await readDomainConfigJson(domain, "support-tickets.json", { tickets: [] });
  emit({ ok: true, tickets: data.tickets ?? [] });
}

export async function ticketsCreate(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const subject = String(payload.subject || "").trim();
  const body = String(payload.body || "").trim();
  const email = String(payload.email || "").trim();
  if (!subject || !body) fail("Subject and message required");
  const data = await readDomainConfigJson(domain, "support-tickets.json", { tickets: [] });
  const tickets = Array.isArray(data.tickets) ? data.tickets : [];
  const ticket = {
    id: newId(),
    subject,
    email,
    status: "open",
    createdAt: new Date().toISOString(),
    messages: [{ from: email || "client", body, at: new Date().toISOString() }],
  };
  tickets.unshift(ticket);
  await writeDomainConfigJson(domain, "support-tickets.json", { tickets: tickets.slice(0, 200) });
  emit({ ok: true, ticket });
}

export async function ticketsReply(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const id = String(payload.id || "").trim();
  const body = String(payload.body || "").trim();
  const from = String(payload.from || "support").trim();
  if (!id || !body) fail("Ticket id and reply required");
  const data = await readDomainConfigJson(domain, "support-tickets.json", { tickets: [] });
  const ticket = (data.tickets ?? []).find((t) => t.id === id);
  if (!ticket) fail("Ticket not found");
  ticket.messages.push({ from, body, at: new Date().toISOString() });
  if (payload.close) ticket.status = "closed";
  await writeDomainConfigJson(domain, "support-tickets.json", data);
  emit({ ok: true, ticket });
}

export async function billingInvoicesList(domain) {
  const data = await readDomainConfigJson(domain, "billing-invoices.json", { invoices: [] });
  emit({ ok: true, invoices: data.invoices ?? [] });
}

export async function billingInvoiceCreate(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const amount = parseFloat(String(payload.amount || "0"));
  const description = String(payload.description || "").trim();
  const clientEmail = String(payload.clientEmail || "").trim();
  if (!description || !amount) fail("Description and amount required");
  const data = await readDomainConfigJson(domain, "billing-invoices.json", { invoices: [] });
  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  const invoice = {
    id: newId(),
    description,
    amount,
    currency: String(payload.currency || "EUR"),
    clientEmail,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  invoices.unshift(invoice);
  await writeDomainConfigJson(domain, "billing-invoices.json", { invoices: invoices.slice(0, 100) });
  emit({ ok: true, invoice });
}

export async function nodesHealth() {
  const nodes = await readDomainConfigJson("_global", "cluster-nodes.json", { nodes: [] }).catch(
    () => ({ nodes: [] }),
  );
  const list = nodes.nodes ?? [];
  emit({
    ok: true,
    nodes: list,
    local: { hostname: process.env.QADBAK_PUBLIC_HOST || "localhost", role: "primary" },
  });
}

export async function nodesRegister(payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const host = String(payload.host || "").trim();
  const label = String(payload.label || host).trim();
  if (!host) fail("Host required");
  const data = await readDomainConfigJson("_global", "cluster-nodes.json", { nodes: [] });
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  if (!nodes.some((n) => n.host === host)) {
    nodes.push({ host, label, addedAt: new Date().toISOString(), status: "unknown" });
  }
  await writeDomainConfigJson("_global", "cluster-nodes.json", { nodes });
  emit({ ok: true, nodes });
}

export async function carddavStatus(domain) {
  await resolveDomainUser(domain);
  const cfg = await readDomainConfigJson(domain, "carddav.json", {
    enabled: false,
    url: "",
    note: "Install Radicale or Baïkal for full CardDAV; export vCard contacts below.",
  });
  const contacts = await readDomainConfigJson(domain, "carddav-contacts.json", { contacts: [] });
  emit({ ok: true, config: cfg, contacts: contacts.contacts ?? [] });
}

export async function carddavContactUpsert(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const data = await readDomainConfigJson(domain, "carddav-contacts.json", { contacts: [] });
  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const email = String(payload.email || "").trim();
  const name = String(payload.name || "").trim();
  if (!email) fail("Email required");
  const existing = contacts.find((c) => c.email === email);
  const row = { email, name, phone: String(payload.phone || ""), updatedAt: new Date().toISOString() };
  if (existing) Object.assign(existing, row);
  else contacts.push(row);
  await writeDomainConfigJson(domain, "carddav-contacts.json", { contacts });
  emit({ ok: true, contacts });
}
