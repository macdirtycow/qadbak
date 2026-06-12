import { checkRateLimit } from "@/lib/api-rate-limit";
import { getClientIp } from "@/lib/client-ip";
import {
  newsletterCorsHeaders,
  newsletterJsonResponse,
} from "@/lib/newsletter/cors";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";
import { NextResponse } from "next/server";

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #1e293b; }
    h1 { font-size: 1.5rem; }
    p { line-height: 1.6; color: #475569; }
  </style>
</head>
<body><h1>${title}</h1><p>${body}</p></body>
</html>`;
}

export async function GET(request: Request) {
  const ip = (await getClientIp()) ?? "unknown";
  const rl = await checkRateLimit(`newsletter-confirm:${ip}`, 30, 60 * 60 * 1000);
  if (!rl.ok) {
    return new NextResponse("Too many requests.", {
      status: 429,
      headers: newsletterCorsHeaders(),
    });
  }

  const url = new URL(request.url);
  const domain = url.searchParams.get("domain")?.trim().toLowerCase();
  const token = url.searchParams.get("token")?.trim();
  const wantsJson = url.searchParams.get("format") === "json";

  if (!domain || !token) {
    if (wantsJson) {
      return newsletterJsonResponse({ error: "domain and token required." }, { status: 400 });
    }
    return new NextResponse(
      htmlPage("Invalid link", "This confirmation link is incomplete or invalid."),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  try {
    const raw = await runProvisioningHelper("newsletter-public-confirm", domain, token);
    if (wantsJson) {
      return newsletterJsonResponse({ ok: true, email: raw.email, status: raw.status });
    }
    return new NextResponse(
      htmlPage(
        "Subscription confirmed",
        `Your email address <strong>${String(raw.email)}</strong> is now confirmed. You can close this page.`,
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Confirmation failed.";
    if (wantsJson) {
      return newsletterJsonResponse({ error: msg }, { status: 400 });
    }
    return new NextResponse(htmlPage("Confirmation failed", msg), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
