import { AdminApiKeysView } from "@/components/AdminApiKeysView";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminApiKeysPage() {
  await requireAdminPage();
  return <AdminApiKeysView />;
}
