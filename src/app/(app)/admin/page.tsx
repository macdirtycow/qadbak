import { Card, PageHeader } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { adminNavItems } from "@/lib/features";
import Link from "next/link";

export default function AdminOverviewPage() {
  const items = adminNavItems().filter((n) => n.path !== "/admin");
  const privacy = items.find((n) => n.path === "/admin/privacy");
  const rest = items.filter((n) => n.path !== "/admin/privacy");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Server admin"
        description="Shortcuts to server status, services, networking, management, and panel settings."
      />
      {privacy && (
        <Link href={privacy.path}>
          <Card className="border-panel-accent/50 bg-panel-accent/5 transition hover:border-panel-accent">
            <h2 className="text-lg font-medium text-white">{privacy.label}</h2>
            <p className="mt-2 text-sm text-panel-muted">
              What stays on your VPS, outbound license heartbeat, audit export, and
              hardening links - local-first by design.
            </p>
          </Card>
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((item) => (
          <Link key={item.path} href={item.path}>
            <Card className="transition hover:border-panel-accent">
              <h2 className="font-medium text-white">{item.label}</h2>
              <p className="mt-1 text-sm text-panel-muted">Admin →</p>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="border-dashed border-panel-border/80 bg-panel-card/30">
        <p className="text-sm text-panel-muted">
          <span className="text-panel-muted/70">2009 → today · </span>
          From press-release vapor to a VPS you can actually log into.{" "}
          <Link href="/about" className="text-panel-link hover:underline">
            About the name {APP_NAME}
          </Link>
        </p>
      </Card>
    </div>
  );
}
