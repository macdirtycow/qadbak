"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems } from "@/lib/features";
import { PremiumNavLock } from "@/lib/premium/stubs";

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 border-b border-panel-border pb-4">
      {adminNavItems().map((item) => (
        <Link
          key={item.path}
          href={item.path}
          className={`rounded-lg px-3 py-2 text-sm ${
            pathname === item.path
              ? "bg-panel-accent/20 text-white"
              : "text-panel-muted hover:bg-panel-card hover:text-white"
          }`}
        >
          {item.label}
          {item.premium ? <PremiumNavLock /> : null}
        </Link>
      ))}
    </nav>
  );
}
