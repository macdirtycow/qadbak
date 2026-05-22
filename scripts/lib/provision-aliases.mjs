import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
} from "./provisioning-common.mjs";
import {
  discoverMailLayout,
  appendMapEntry,
  removeMapEntry,
  postmapReload,
} from "./mail-layout.mjs";

function normFrom(domain, from) {
  const f = String(from || "").trim();
  if (!f) fail("Alias from address required");
  return f.includes("@") ? f.toLowerCase() : `${f.toLowerCase()}@${domain}`;
}

export async function aliasList(domain) {
  await resolveDomainUser(domain);
  const aliases = await readDomainConfigJson(domain, "aliases.json", []);
  emit({ ok: true, aliases, source: "qadbak-domain-config" });
}

export async function aliasCreate(domain, from, to) {
  const { user, home } = await resolveDomainUser(domain);
  const address = normFrom(domain, from);
  const dest = String(to || "").trim();
  const aliases = await readDomainConfigJson(domain, "aliases.json", []);
  if (aliases.some((a) => a.from.toLowerCase() === address)) {
    fail(`Alias already exists: ${address}`);
  }
  aliases.push({ from: address, to: dest });
  await writeDomainConfigJson(domain, "aliases.json", aliases);

  const layout = await discoverMailLayout(domain, user, home);
  const mapPath = layout.aliasMap || "/etc/postfix/virtual";
  await appendMapEntry(mapPath, address, dest);
  await postmapReload(mapPath);
  emit({ ok: true, from: address, to: dest });
}

export async function aliasDelete(domain, from) {
  const { user, home } = await resolveDomainUser(domain);
  const address = normFrom(domain, from);
  let aliases = await readDomainConfigJson(domain, "aliases.json", []);
  aliases = aliases.filter((a) => a.from.toLowerCase() !== address);
  await writeDomainConfigJson(domain, "aliases.json", aliases);

  const layout = await discoverMailLayout(domain, user, home);
  const mapPath = layout.aliasMap || "/etc/postfix/virtual";
  await removeMapEntry(mapPath, address);
  await postmapReload(mapPath);
  emit({ ok: true });
}
