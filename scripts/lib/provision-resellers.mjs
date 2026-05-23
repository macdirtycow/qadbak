import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { emit, fail, QADBAK_DIR } from "./provisioning-common.mjs";

const STORE = path.join(QADBAK_DIR, "data", "native-plans-resellers.json");

async function loadStore() {
  try {
    const raw = await readFile(STORE, "utf8");
    const o = JSON.parse(raw);
    return {
      resellers: Array.isArray(o.resellers) ? o.resellers : [],
      plans: Array.isArray(o.plans) ? o.plans : [{ name: "Default", quota: "unlimited" }],
    };
  } catch {
    return {
      resellers: [],
      plans: [{ name: "Default", quota: "unlimited", mailboxes: "50", databases: "10" }],
    };
  }
}

async function saveStore(data) {
  await mkdir(path.dirname(STORE), { recursive: true });
  await writeFile(STORE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function resellerList() {
  const { resellers } = await loadStore();
  emit({
    ok: true,
    resellers: resellers.map((r) => ({
      name: r.name,
      domains: String(r.domains ?? r.maxDomains ?? "0"),
      limit: String(r.limit ?? r.maxDomains ?? ""),
    })),
    source: "qadbak-native",
  });
}

export async function resellerCreate(name, pass) {
  const n = String(name || "").trim();
  if (!n || !/^[a-z][a-z0-9._-]{0,31}$/i.test(n)) fail("Invalid reseller name.");
  const store = await loadStore();
  if (store.resellers.some((r) => r.name === n)) fail(`Reseller exists: ${n}`);
  store.resellers.push({
    name: n,
    maxDomains: 10,
    domains: "0",
    limit: "10",
    createdAt: new Date().toISOString(),
    hasPassword: Boolean(pass),
  });
  await saveStore(store);
  emit({ ok: true, name: n });
}

export async function resellerDelete(name) {
  const n = String(name || "").trim();
  const store = await loadStore();
  store.resellers = store.resellers.filter((r) => r.name !== n);
  await saveStore(store);
  emit({ ok: true });
}

export async function planList() {
  const { plans } = await loadStore();
  emit({
    ok: true,
    plans: plans.map((p) => ({
      name: p.name,
      id: p.id ?? p.name,
      quota: p.quota ?? p.disk,
    })),
    source: "qadbak-native",
  });
}

export async function planCreate(name) {
  const n = String(name || "").trim();
  if (!n) fail("Plan name required.");
  const store = await loadStore();
  if (store.plans.some((p) => p.name === n)) fail(`Plan exists: ${n}`);
  store.plans.push({ name: n, quota: "10GB", mailboxes: "25", databases: "5" });
  await saveStore(store);
  emit({ ok: true, name: n });
}

export async function planDelete(name) {
  const n = String(name || "").trim();
  const store = await loadStore();
  if (n === "Default") fail("Cannot delete Default plan.");
  store.plans = store.plans.filter((p) => p.name !== n);
  await saveStore(store);
  emit({ ok: true });
}
