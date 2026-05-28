import { AccountTotpSetup } from "@/components/AccountTotpSetup";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const session = await requireSession().catch(() => null);
  if (!session) redirect("/login");
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Account security</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Signed in as <span className="text-white">{session.username}</span>.
        </p>
      </header>
      <AccountTotpSetup />
    </div>
  );
}
