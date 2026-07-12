import { requireAdminPage } from "@/lib/admin-api";
import { JournalBrowser } from "@/components/admin/JournalBrowser";

export const dynamic = "force-dynamic";

export default async function AdminJournalPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">
          Journal · what just happened
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-panel-muted">
          Every action that mutates this server - domain creates, mail changes,
          certificate issuance, DNS edits - is recorded here with the exact
          file writes, shell commands and service reloads it triggered. Use it
          to learn, debug, or audit.
        </p>
      </header>
      <JournalBrowser />
    </div>
  );
}
