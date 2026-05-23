import { Card } from "@/components/ui";
import { DOMAIN_FEATURES, IMPLEMENTED_PHASE } from "@/lib/features";
const PHASE_LABELS: Record<number, string> = {
  1: "Core",
  2: "DNS, SSL, aliases, redirects, backups",
  3: "Website & PHP",
  4: "Domain lifecycle",
  5: "Scripts & proxies",
  6: "Mail & FTP extended",
  7: "Server & reseller",
  8: "Cloud & advanced",
};

export default function PhasesPage() {
  const phases = [1, 2, 3, 4, 5, 6, 7, 8] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Integration phases</h1>
        <p className="mt-1 text-panel-muted">
          Native panel features shipped in successive releases. Currently active: phase{" "}
          {IMPLEMENTED_PHASE}.
        </p>
        <p className="mt-2 text-sm text-panel-muted">
          See <code className="text-white">docs/PHASES.md</code> in the project for the full API list per phase.
        </p>
      </div>

      {phases.map((phase) => {
        const features = DOMAIN_FEATURES.filter((f) => f.phase === phase);
        const done = phase <= IMPLEMENTED_PHASE;
        return (
          <Card key={phase}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium text-white">
                Phase {phase} — {PHASE_LABELS[phase]}
              </h2>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  done
                    ? "bg-emerald-900/50 text-emerald-300"
                    : "bg-slate-800 text-panel-muted"
                }`}
              >
                {done ? "Implemented" : "Planned"}
              </span>
            </div>
            {features.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-panel-muted">
                {features.map((f) => (
                  <li key={f.id}>
                    <span className="text-white">{f.label}</span> — {f.description}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-panel-muted">
                Server-wide features — see docs/PHASES.md
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
