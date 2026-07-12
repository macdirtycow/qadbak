import { redirect } from "next/navigation";

/** Phases roadmap is internal/docs only - not shown in the panel. */
export default function AdminPhasesPage() {
  redirect("/admin");
}
