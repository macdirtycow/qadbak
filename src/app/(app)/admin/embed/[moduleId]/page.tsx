import { WebminEmbed } from "@/components/WebminEmbed";
import { requireAdminPage } from "@/lib/admin-api";
import { catalogMenuPath, catalogModule } from "@/lib/webmin-catalog";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ moduleId: string }> };

export default async function AdminEmbedPage({ params }: Props) {
  await requireAdminPage();
  const { moduleId } = await params;
  const mod = catalogModule(moduleId);
  if (!mod) notFound();

  return (
    <div className="space-y-4">
      <p className="text-sm text-panel-muted">
        <Link href={catalogMenuPath(mod.category)} className="hover:text-white">
          ← Back
        </Link>
      </p>
      <WebminEmbed
        title={mod.label}
        fetchUrl={`/api/admin/webmin/link?module=${encodeURIComponent(mod.id)}`}
        height="min(78vh, 860px)"
      />
    </div>
  );
}
