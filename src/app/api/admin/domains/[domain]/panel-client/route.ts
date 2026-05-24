import { dispatchPremiumRoute } from "@/lib/premium/guard";

type Props = { params: Promise<{ domain: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { domain } = await params;
  return dispatchPremiumRoute("admin.domains.panel-client", "GET", _request, {
    params: { domain },
  });
}

export async function POST(request: Request, { params }: Props) {
  const { domain } = await params;
  return dispatchPremiumRoute("admin.domains.panel-client", "POST", request, {
    params: { domain },
  });
}
