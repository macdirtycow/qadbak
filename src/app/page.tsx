import { MarketingHome } from "@/components/MarketingHome";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return <MarketingHome />;
}
