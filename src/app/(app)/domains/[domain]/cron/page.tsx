import { CronManager } from "@/components/CronManager";
import { requireDomainAccess } from "@/lib/domain-api";
import { listCronJobsWithFallback } from "@/lib/virtualmin";

type Props = { params: Promise<{ domain: string }> };

export default async function CronPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  let jobs: Awaited<ReturnType<typeof listCronJobsWithFallback>> = [];
  let error = "";
  try {
    jobs = await listCronJobsWithFallback(domain, session);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load cron jobs.";
  }
  return (
    <CronManager
      domain={domain}
      initialJobs={jobs}
      canEdit={session.role === "admin"}
      initialError={error}
    />
  );
}
