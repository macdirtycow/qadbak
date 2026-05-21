import { WebminModuleBrowser } from "@/components/WebminModuleBrowser";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminServersMenuPage() {
  await requireAdminPage();
  return <WebminModuleBrowser category="servers" />;
}
