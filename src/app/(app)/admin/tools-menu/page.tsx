import { WebminModuleBrowser } from "@/components/WebminModuleBrowser";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminToolsMenuPage() {
  await requireAdminPage();
  return <WebminModuleBrowser category="tools" />;
}
