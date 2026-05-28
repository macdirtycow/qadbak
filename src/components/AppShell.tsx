"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { APP_NAME, DEFAULT_LOGO_PATH } from "@/lib/brand";
import { PanelFooter } from "./PanelFooter";
import { NavLink, Button } from "./ui";

interface AppShellProps {
  children: React.ReactNode;
  username: string;
  role: "admin" | "client";
  brandName?: string;
  logoUrl?: string | null;
}

export function AppShell({
  children,
  username,
  role,
  brandName,
  logoUrl,
}: AppShellProps) {
  const title = brandName ?? APP_NAME;
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-panel-border bg-panel-card/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-lg font-semibold text-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl ?? DEFAULT_LOGO_PATH}
                alt=""
                className={
                  logoUrl
                    ? "h-8 w-auto max-w-[120px]"
                    : "h-8 w-8 shrink-0"
                }
              />
              {title}
            </Link>
            <nav className="flex gap-1">
              <NavLink href="/dashboard" active={pathname === "/dashboard"}>
                Dashboard
              </NavLink>
              <NavLink href="/domains" active={pathname.startsWith("/domains")}>
                Domains
              </NavLink>
              {role === "admin" && (
                <NavLink
                  href="/admin"
                  active={pathname.startsWith("/admin")}
                >
                  Server admin
                </NavLink>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/account/security"
              className="text-panel-muted hover:text-white"
            >
              Security
            </Link>
            <span className="text-panel-muted">
              {username}
              <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs">
                {role === "admin" ? "admin" : "client"}
              </span>
            </span>
            <Button variant="ghost" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <div className="mx-auto w-full max-w-6xl px-4 pb-8">
        <PanelFooter />
      </div>
    </div>
  );
}
