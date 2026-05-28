import { AdminCloudCredentials } from "@/components/AdminCloudCredentials";
import { AdminCloudView } from "@/components/AdminCloudView";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminCloudPage() {
  await requireAdminPage();
  return (
    <div className="space-y-8">
      <AdminCloudCredentials />
      <AdminCloudView initialError="" />
    </div>
  );
}
