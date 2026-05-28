import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/** Public alias — admins see the full phase hub. */
export default async function FasesPage() {
  const session = await getSession();
  if (session?.role === "admin") {
    redirect("/admin/phases");
  }
  redirect("/dashboard");
}
