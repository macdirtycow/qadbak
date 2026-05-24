import { AdminNav } from "@/components/AdminNav";
import { adminNavItems } from "@/lib/features";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const unlockedPremium: string[] = [];
  for (const item of adminNavItems()) {
    if (item.premium && (await isPremiumFeatureEnabled(item.premium))) {
      unlockedPremium.push(item.premium);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Server admin</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Resellers, plans, templates, and system status
        </p>
      </div>
      <AdminNav unlockedPremium={unlockedPremium} />
      {children}
    </div>
  );
}
