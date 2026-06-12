import { checkRateLimit } from "@/lib/api-rate-limit";
import { getClientIp } from "@/lib/client-ip";
import {
  newsletterJsonResponse,
  newsletterOptionsResponse,
} from "@/lib/newsletter/cors";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

export async function OPTIONS() {
  return newsletterOptionsResponse();
}

export async function POST(request: Request) {
  const ip = (await getClientIp()) ?? "unknown";
  const rl = await checkRateLimit(`newsletter-sub:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return newsletterJsonResponse(
      { error: "Too many requests. Try again later.", retryAfterSec: rl.retryAfterSec },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      domain?: string;
      listId?: string;
      email?: string;
      name?: string;
    };
    const domain = body.domain?.trim().toLowerCase();
    if (!domain || !body.listId || !body.email?.trim()) {
      return newsletterJsonResponse(
        { error: "domain, listId, and email are required." },
        { status: 400 },
      );
    }

    await runProvisioningHelper(
      "newsletter-public-subscribe",
      domain,
      JSON.stringify({
        listId: body.listId,
        email: body.email.trim(),
        name: body.name?.trim() ?? "",
      }),
    );

    return newsletterJsonResponse({
      ok: true,
      message:
        "Thank you! If double opt-in is enabled, check your inbox to confirm your subscription.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Subscribe failed.";
    return newsletterJsonResponse({ error: msg }, { status: 400 });
  }
}
