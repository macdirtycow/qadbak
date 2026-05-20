import { WebminHub } from "@/components/WebminHub";
import { requireAdminPage } from "@/lib/admin-api";
import {
  userminUiBase,
  webminModulesForAdmin,
  webminUiBase,
} from "@/lib/webmin";

export default async function AdminWebminPage() {
  await requireAdminPage();
  return (
    <WebminHub
      title="Webmin"
      description="Full server management interface alongside Nexmin — Apache, DNS, firewall, logs, and more."
      modules={webminModulesForAdmin()}
      linkApiPath="/api/admin/webmin/link"
      showRootBanner
      webminBase={webminUiBase()}
      userminBase={userminUiBase()}
    />
  );
}
