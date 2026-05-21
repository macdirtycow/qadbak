import { WebminModuleBrowser } from "@/components/WebminModuleBrowser";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminNetworkingMenuPage() {
  await requireAdminPage();
  return <WebminModuleBrowser category="networking" />;
}
