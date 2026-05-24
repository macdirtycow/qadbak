import {
  emit,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
} from "./provisioning-common.mjs";
import {
  rebuildPostfixMailboxMaps,
  rebuildVirtualAliasMap,
  stripVirtualAliasMailboxConflicts,
} from "./mail-sync.mjs";
import { postmapReloadAll, ensureVirtualAliasMapsEnabled } from "./mail-layout.mjs";
import { applyDomainMailSettings } from "./mail-settings-apply.mjs";

const DEFAULTS = {
  catchAll: "",
  autoresponder: "",
  autoresponderEnabled: false,
};

export async function mailSettingsGet(domain) {
  await resolveDomainUser(domain);
  const settings = await readDomainConfigJson(domain, "mail-settings.json", DEFAULTS);
  emit({ ok: true, settings, source: "qadbak-domain-config" });
}

export async function mailSettingsSet(domain, settingsJson) {
  await resolveDomainUser(domain);
  let settings = settingsJson;
  if (typeof settingsJson === "string") {
    try {
      settings = JSON.parse(settingsJson);
    } catch {
      settings = DEFAULTS;
    }
  }
  const merged = {
    ...DEFAULTS,
    ...settings,
  };
  await writeDomainConfigJson(domain, "mail-settings.json", merged);
  const applied = await applyDomainMailSettings(domain, merged);
  const { emails } = await rebuildPostfixMailboxMaps();
  await rebuildVirtualAliasMap();
  await stripVirtualAliasMailboxConflicts(emails);
  await ensureVirtualAliasMapsEnabled();
  await postmapReloadAll();
  emit({ ok: true, applied });
}
