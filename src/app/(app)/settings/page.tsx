import { SettingsHub } from "@/components/admin/SettingsHub";
import { SETTINGS_ENTRIES } from "@/lib/settings-registry";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

async function unlockedPremiumForSettings(): Promise<string[]> {
  const ids = new Set<string>();
  for (const e of SETTINGS_ENTRIES) {
    if (e.premium) ids.add(e.premium);
  }
  const unlocked: string[] = [];
  for (const id of ids) {
    if (await isPremiumFeatureEnabled(id)) unlocked.push(id);
  }
  return unlocked;
}

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const unlockedPremium = await unlockedPremiumForSettings();
  return (
    <SettingsHub role={session.role} unlockedPremium={unlockedPremium} />
  );
}
