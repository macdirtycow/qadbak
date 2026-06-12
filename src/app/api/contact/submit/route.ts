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
  const rl = await checkRateLimit(`contact-form:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return newsletterJsonResponse({ error: "Too many requests." }, { status: 429 });
  }

  try {
    const body = (await request.json()) as {
      domain?: string;
      listId?: string;
      email?: string;
      name?: string;
      message?: string;
    };
    const domain = body.domain?.trim().toLowerCase();
    if (!domain || !body.listId) {
      return newsletterJsonResponse({ error: "domain and listId required." }, { status: 400 });
    }
    await runProvisioningHelper(
      "contact-form-submit",
      domain,
      JSON.stringify(body),
    );
    return newsletterJsonResponse({ ok: true, message: "Message sent. Thank you!" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Submit failed.";
    return newsletterJsonResponse({ error: msg }, { status: 400 });
  }
}
