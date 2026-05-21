import { WebminModuleBrowser } from "@/components/WebminModuleBrowser";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminHardwareMenuPage() {
  await requireAdminPage();
  return <WebminModuleBrowser category="hardware" />;
}
