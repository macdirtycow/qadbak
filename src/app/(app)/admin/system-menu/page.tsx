import { WebminModuleBrowser } from "@/components/WebminModuleBrowser";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminSystemMenuPage() {
  await requireAdminPage();
  return <WebminModuleBrowser category="system" />;
}
