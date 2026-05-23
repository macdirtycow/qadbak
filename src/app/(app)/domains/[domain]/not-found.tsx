import { Button, Card } from "@/components/ui";
import Link from "next/link";

export default function DomainNotFound() {
  return (
    <Card className="max-w-lg">
      <h1 className="text-xl font-semibold text-white">Domain not found</h1>
      <p className="mt-3 text-sm text-panel-muted">
        This domain is not registered on the host yet. Create it in Qadbak, then open it from the
        domains list.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/domains/new">
          <Button>New domain</Button>
        </Link>
        <Link href="/domains">
          <Button variant="secondary">All domains</Button>
        </Link>
      </div>
    </Card>
  );
}
