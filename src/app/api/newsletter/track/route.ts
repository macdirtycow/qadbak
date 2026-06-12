import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain")?.trim().toLowerCase();
  const kind = url.searchParams.get("kind") === "click" ? "click" : "open";
  const campaignId = url.searchParams.get("c") ?? "";
  const email = url.searchParams.get("e") ?? "";
  const redirect = url.searchParams.get("url");

  if (domain) {
    try {
      await runProvisioningHelper(
        "newsletter-track-record",
        domain,
        JSON.stringify({ kind, campaignId, email }),
      );
    } catch {
      /* */
    }
  }

  if (kind === "click" && redirect) {
    try {
      return Response.redirect(redirect, 302);
    } catch {
      /* */
    }
  }

  return new Response(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
  });
}
