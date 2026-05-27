import { Card } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { adminNavItems } from "@/lib/features";
import Link from "next/link";

export default function AdminOverviewPage() {
  const items = adminNavItems().filter((n) => n.path !== "/admin");
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
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
