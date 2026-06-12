import { AppShell } from "@/components/AppShell";
import { displayBranding, loadPanelBranding, logoPublicPath } from "@/lib/branding";
import { demoReadOnlyEnabled, isDemoHost } from "@/lib/demo-mode";
import { getSession } from "@/lib/session";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
  return (
    <AppShell
      username={session.username}
      role={session.role}
      brandName={b.brandName}
      logoUrl={logoPublicPath(b.hasLogo)}
      demoBanner={demoBanner}
    >
      {children}
    </AppShell>
  );
}
