import { DomainTerminal } from "@/components/DomainTerminal";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminTerminalPage() {
  await requireAdminPage();

  return (
    <DomainTerminal
      fetchUrl="/api/admin/terminal/ws-token"
      wsPath="/ws/admin-terminal"
      title="Server terminal"
      subtitle="Root shell on this VPS - no separate SSH. Only Qadbak administrators can open this session."
    />
  );
}
