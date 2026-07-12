import { AppShell } from "@/components/AppShell";
import { displayBranding, loadPanelBranding, logoPublicPath } from "@/lib/branding";
import { flattenSidebarItems, sidebarCategoriesForRole } from "@/lib/navigation";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";
import { demoReadOnlyEnabled, isDemoHost } from "@/lib/demo-mode";
import { getSession } from "@/lib/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function unlockedPremiumForRole(role: "admin" | "client"): Promise<string[]> {
  const categories = sidebarCategoriesForRole(role);
  const items = flattenSidebarItems(categories);
  const ids = new Set<string>();
  for (const item of items) {
    if (item.premium) ids.add(item.premium);
  }
  const unlocked: string[] = [];
  for (const id of ids) {
    if (await isPremiumFeatureEnabled(id)) {
      unlocked.push(id);
    }
  }
  return unlocked;
}

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const stored = await loadPanelBranding();
  const b = displayBranding(stored);
  const host = (await headers()).get("host");
  const demoBanner = demoReadOnlyEnabled() && isDemoHost(host);
  const unlockedPremium = await unlockedPremiumForRole(session.role);

  return (
    <AppShell
      username={session.username}
      role={session.role}
      brandName={b.brandName}
      logoUrl={logoPublicPath(b.hasLogo)}
      demoBanner={demoBanner}
      unlockedPremium={unlockedPremium}
    >
      {children}
    </AppShell>
  );
}
