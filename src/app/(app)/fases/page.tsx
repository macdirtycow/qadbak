import { redirect } from "next/navigation";

/** Phases overview removed from commercial panel navigation. */
export default function PhasesPage() {
  redirect("/dashboard");
}
