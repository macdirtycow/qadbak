import { PhasesHub } from "@/components/admin/PhasesHub";
import { requireAdminPage } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export default async function AdminPhasesPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">8 fasen · roadmap</h1>
        <p className="mt-1 max-w-3xl text-sm text-panel-muted">
          Qadbak is uitgerold in acht marktfasen: van native productie tot API-integraties.
          Gebruik dit overzicht om per fase te zien wat er is, waar het in het panel zit, en
          of jouw VPS de checks haalt.
        </p>
      </header>
      <PhasesHub />
    </div>
  );
}
