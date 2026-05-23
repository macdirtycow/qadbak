import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
} from "./provisioning-common.mjs";

function normAddress(domain, address) {
  const a = String(address || "").trim().toLowerCase();
  if (!a) fail("Address required");
  return a.includes("@") ? a : `${a}@${domain}`;
}

export async function sharedList(domain) {
  await resolveDomainUser(domain);
  const addresses = await readDomainConfigJson(domain, "shared-addresses.json", []);
  emit({ ok: true, addresses, source: "qadbak-domain-config" });
}

export async function sharedCreate(domain, address, users) {
  await resolveDomainUser(domain);
  const addr = normAddress(domain, address);
  const list = await readDomainConfigJson(domain, "shared-addresses.json", []);
  if (list.some((a) => a.address === addr)) fail(`Shared address exists: ${addr}`);
  list.push({ address: addr, users: String(users || "").trim() });
  await writeDomainConfigJson(domain, "shared-addresses.json", list);
  emit({ ok: true, address: addr });
}

export async function sharedDelete(domain, address) {
  const addr = normAddress(domain, address);
  let list = await readDomainConfigJson(domain, "shared-addresses.json", []);
  list = list.filter((a) => a.address !== addr);
  await writeDomainConfigJson(domain, "shared-addresses.json", list);
  emit({ ok: true });
}
