import { redirect } from "next/navigation";

/** Legacy URL — not exposed in navigation. */
export default function FasesPage() {
  redirect("/dashboard");
}
