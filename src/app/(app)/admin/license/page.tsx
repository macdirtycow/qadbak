import { AdminLicensePanel } from "@/components/AdminLicensePanel";
import { requireAdminPage } from "@/lib/admin-api";
import { getLicensePublicInfo } from "@/lib/qadbak-license";
import { getProvisioner } from "@/lib/provisioner";

export default async function AdminLicensePage() {
  const session = await requireAdminPage();
  let error = "";
  let license = await getLicensePublicInfo();
  try {
    const domains = await getProvisioner().listDomains(session);
    license = await getLicensePublicInfo(domains.length);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load license.";
  }
  return <AdminLicensePanel initialLicense={license} initialError={error} />;
}
