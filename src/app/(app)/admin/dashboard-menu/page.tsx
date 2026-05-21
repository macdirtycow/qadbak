import { redirect } from "next/navigation";

export default function AdminDashboardMenuPage() {
  redirect("/admin/status");
}
