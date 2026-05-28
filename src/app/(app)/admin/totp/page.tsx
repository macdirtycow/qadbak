import { AccountTotpSetup } from "@/components/AccountTotpSetup";
import { requireAdminPage } from "@/lib/admin-api";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminTotpPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Two-factor authentication</h1>
        <p className="mt-1 max-w-2xl text-sm text-panel-muted">
          Protect your admin account with a TOTP authenticator. Client accounts can enable
          the same under{" "}
          <Link href="/account/security" className="text-panel-link hover:underline">
            Account security
          </Link>
          . See also{" "}
          <Link href="/admin/privacy" className="text-panel-link hover:underline">
            Privacy &amp; data
          </Link>
          .
        </p>
      </header>
      <AccountTotpSetup />
    </div>
  );
}
