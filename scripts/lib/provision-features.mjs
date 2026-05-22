import { emit } from "./provisioning-common.mjs";
import {
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
} from "./provisioning-common.mjs";

const DEFAULT_FEATURES = [
  { feature: "web", label: "Website", enabled: true },
  { feature: "dns", label: "DNS", enabled: true },
  { feature: "mail", label: "Mail", enabled: true },
  { feature: "mysql", label: "MySQL", enabled: true },
  { feature: "ssl", label: "SSL", enabled: true },
];

export async function featureList(domain) {
  await resolveDomainUser(domain);
  let features = await readDomainConfigJson(domain, "features.json", null);
  if (!features) features = DEFAULT_FEATURES;
  emit({ ok: true, features, source: "qadbak-domain-config" });
}

export async function featureSet(domain, feature, enabled) {
  await resolveDomainUser(domain);
  let features = await readDomainConfigJson(domain, "features.json", DEFAULT_FEATURES);
  const f = String(feature || "").trim().toLowerCase();
  let hit = false;
  features = features.map((row) => {
    if (row.feature.toLowerCase() === f) {
      hit = true;
      return { ...row, enabled: Boolean(enabled) };
    }
    return row;
  });
  if (!hit) features.push({ feature: f, label: f, enabled: Boolean(enabled) });
  await writeDomainConfigJson(domain, "features.json", features);
  emit({ ok: true });
}
