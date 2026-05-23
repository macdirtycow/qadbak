import { Alert, Card } from "@/components/ui";
import { requireAdminPage } from "@/lib/admin-api";
import { getProvisioner } from "@/lib/provisioner";

export default async function AdminLicensePage() {
  const session = await requireAdminPage();
  let license: Record<string, string> = {};
  let error = "";
  try {
    license = await getProvisioner().getLicenseInfo(session);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load license.";
  }
  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <Card>
        <h2 className="text-lg font-medium text-white">Hosting license</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-panel-muted">Type</dt>
            <dd className="text-white">{license.type ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Domains</dt>
            <dd className="text-white">{license.domains ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Expiry date</dt>
            <dd className="text-white">{license.expiry ?? "—"}</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-panel-muted">
          Qadbak manages licensing metadata on this server. Domain limits follow your
          capacity and panel configuration.
        </p>
      </Card>
    </div>
  );
}
