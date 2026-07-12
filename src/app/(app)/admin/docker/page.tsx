import { DockerManager } from "@/components/admin/DockerManager";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminDockerPage() {
  await requireAdminPage();
  return <DockerManager />;
}
