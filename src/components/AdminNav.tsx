"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems } from "@/lib/features";
import { PremiumNavLock } from "@/lib/premium/stubs";

export function AdminNav({
  unlockedPremium = [],
}: {
  /** Premium feature IDs active on this server (from license + synced modules). */
  unlockedPremium?: string[];
}) {
  const pathname = usePathname();
  const unlocked = new Set(unlockedPremium);
  return (
    <nav className="flex flex-wrap gap-2 border-b border-panel-border pb-4">
      {adminNavItems().map((item) => {
        const showLock =
          item.premium && !unlocked.has(item.premium);
        return (
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
            {showLock ? <PremiumNavLock /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
