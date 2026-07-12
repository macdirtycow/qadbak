import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

function isHttpsRequest(request: NextRequest): boolean {
  const xfp = request.headers.get("x-forwarded-proto");
  if (xfp) return xfp.toLowerCase().split(",")[0].trim() === "https";
  return request.nextUrl.protocol === "https:";
}

/** Apply baseline browser hardening headers (Edge-safe). */
export function applySecurityHeaders(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  if (isHttpsRequest(request)) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  const csp =
    process.env.QADBAK_CSP?.trim() ||
    (process.env.NODE_ENV === "production"
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' ws: wss:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; ")
      : [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self' ws: wss:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "));
  response.headers.set("Content-Security-Policy", csp);

  return response;
}
