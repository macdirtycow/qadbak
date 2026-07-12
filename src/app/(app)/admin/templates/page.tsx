import { Alert, Card } from "@/components/ui";
import { requireAdminPage } from "@/lib/admin-api";
import { getProvisioner } from "@/lib/provisioner";

export default async function AdminTemplatesPage() {
  const session = await requireAdminPage();
  let templates: Awaited<ReturnType<ReturnType<typeof getProvisioner>["listTemplates"]>> = [];
  let error = "";
  try {
    templates = await getProvisioner().listTemplates(session);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load templates.";
  }
  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <Card className="overflow-hidden p-0">
        <p className="px-6 pt-6 text-sm text-panel-muted">
          Server templates for new domains (native registry). Edit data/native-templates.json on the server.
        </p>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-t border-panel-border text-panel-muted">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">ID</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.name} className="border-t border-panel-border/50">
                <td className="px-6 py-3 text-white">{t.name}</td>
                <td className="px-6 py-3">{t.id ?? " - "}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {templates.length === 0 && !error && (
          <p className="px-6 py-8 text-center text-panel-muted">No templates.</p>
        )}
      </Card>
    </div>
  );
}
