import { AdminPrivacyCenter } from "@/components/AdminPrivacyCenter";
import { requireAdminPage } from "@/lib/admin-api";
import { buildPrivacyReport } from "@/lib/privacy-report";

export const dynamic = "force-dynamic";

export default async function AdminPrivacyPage() {
  await requireAdminPage();
  let initialReport = null;
  let initialError: string | undefined;
  try {
    initialReport = await buildPrivacyReport();
  } catch (e) {
    initialError = e instanceof Error ? e.message : "Could not build report.";
  }
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Privacy &amp; data</h1>
        <p className="mt-1 max-w-3xl text-sm text-panel-muted">
          See what stays on your VPS, what can leave it, and which hardening tools are
          available. Qadbak is designed local-first: customer hosting data is not
          sent to our servers - only a small Premium license heartbeat when you opt in.
        </p>
      </header>
      <AdminPrivacyCenter
        initialReport={initialReport}
        initialError={initialError}
      />
    </div>
  );
}
