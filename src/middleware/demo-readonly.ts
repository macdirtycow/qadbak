import { demoReadOnlyEnabled, isDemoUser } from "@/lib/demo-mode";

const DEMO_AUTH_ALLOW = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/mobile",
  "/api/auth/mobile/refresh",
  "/api/demo/info",
]);

const DEMO_READ_ALLOW = new Set(["/api/branding", "/api/health"]);

/** Dangerous GET routes that must not work for the demo user (terminal token, etc.). */
const DEMO_BLOCKED_PATHS: RegExp[] = [
  /^\/api\/admin\/terminal\/ws-token$/,
  /^\/api\/domains\/[^/]+\/terminal\/ws-token$/,
];

export function demoBlockedPath(pathname: string): boolean {
  return DEMO_BLOCKED_PATHS.some((re) => re.test(pathname));
}

export function demoMutationBlocked(
  pathname: string,
  method: string,
  username: string,
): boolean {
  if (!demoReadOnlyEnabled() || !isDemoUser(username)) return false;
  if (!pathname.startsWith("/api/")) return false;
  if (demoBlockedPath(pathname)) return true;
  if (DEMO_AUTH_ALLOW.has(pathname)) return false;
  if (DEMO_READ_ALLOW.has(pathname)) return false;
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;
  return true;
}
