import { AdminFirewallView } from "@/components/AdminFirewallView";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminFirewallPage() {
  await requireAdminPage();
  return <AdminFirewallView />;
}
