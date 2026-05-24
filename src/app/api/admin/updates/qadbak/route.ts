import { dispatchPremiumRoute } from "@/lib/premium/guard";

export async function GET(request: Request) {
  return dispatchPremiumRoute("admin.updates.qadbak", "GET", request);
}

export async function POST(request: Request) {
  return dispatchPremiumRoute("admin.updates.qadbak", "POST", request);
}
