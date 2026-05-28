import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-api";
import { getTemplate } from "@/lib/apps";
import { AppInstallForm } from "@/components/admin/AppInstallForm";

export const dynamic = "force-dynamic";

export default async function AdminAppInstallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const template = await getTemplate(id);
  if (!template) notFound();
  // Note: we send the whole template (including inputs schema) to the
  // client component for form rendering. The install() function is server
  // -only and stays behind the API.
  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{template.icon}</span>
          <h1 className="text-2xl font-semibold text-white">
            Install {template.label}
          </h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-panel-muted">
          {template.description}
        </p>
      </header>
      <AppInstallForm
        template={{
          id: template.id,
          label: template.label,
          tagline: template.tagline,
          icon: template.icon,
          description: template.description,
          etaSeconds: template.etaSeconds,
          inputs: template.inputs,
        }}
      />
    </div>
  );
}
