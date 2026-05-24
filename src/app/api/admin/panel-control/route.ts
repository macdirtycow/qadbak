import { dispatchPremiumRoute } from "@/lib/premium/guard";

export async function GET() {
  return dispatchPremiumRoute("admin.panel-control", "GET", new Request("http://local"));
}

export async function POST(request: Request) {
  return dispatchPremiumRoute("admin.panel-control", "POST", request);
}
