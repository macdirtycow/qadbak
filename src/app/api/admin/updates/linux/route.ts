import { dispatchPremiumRoute } from "@/lib/premium/guard";

export async function GET(request: Request) {
  return dispatchPremiumRoute("admin.updates.linux", "GET", request);
}

export async function POST(request: Request) {
  return dispatchPremiumRoute("admin.updates.linux", "POST", request);
}
