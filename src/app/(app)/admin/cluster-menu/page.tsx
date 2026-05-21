import { WebminModuleBrowser } from "@/components/WebminModuleBrowser";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminClusterMenuPage() {
  await requireAdminPage();
  return <WebminModuleBrowser category="cluster" />;
}
