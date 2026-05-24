import { CreateDomainForm } from "@/components/CreateDomainForm";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";
import { getSession } from "@/lib/session";
import { getProvisioner } from "@/lib/provisioner";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ type?: string }> };

export default async function NewDomainPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/domains");

  const sp = await searchParams;
  const initialType =
    sp.type === "sub" || sp.type === "alias" ? sp.type : "top";

  const domains = await getProvisioner().listDomains(session);
  const parentOptions = domains.map((d) => d.name);
  const premiumMultiTenant = await isPremiumFeatureEnabled("multi-tenant-clients");

  return (
    <div className="space-y-6">
      <p className="text-sm text-panel-muted">
        <Link href="/domains" className="hover:text-white">
          ← Domains
        </Link>
      </p>
      <CreateDomainForm
        parentOptions={parentOptions}
        initialType={initialType}
        premiumMultiTenant={premiumMultiTenant}
      />
    </div>
  );
}
