import "server-only";

let timer: ReturnType<typeof setInterval> | null = null;

function intervalMs(): number {
  const hours = Number(process.env.QADBAK_MOBILE_PUSH_INTERVAL_HOURS ?? "6");
  if (!Number.isFinite(hours) || hours < 1) return 6 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

async function tick(): Promise<void> {
  try {
    const { evaluateMobilePushAlerts } = await import("./mobile-push-alerts");
    const result = await evaluateMobilePushAlerts();
    if (result.sent.length) {
      console.log(
        `[mobile-push] sent ${result.sent.length} alert(s), delivered ${result.delivered} device notification(s)`,
      );
    }
  } catch (e) {
    console.warn(
      `[mobile-push] evaluate failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function startMobilePushScheduler(): void {
  if (process.env.QADBAK_DISABLE_MOBILE_PUSH_SCHEDULER === "true") return;
  if (timer) return;
  void tick();
  timer = setInterval(() => void tick(), intervalMs());
  console.log(
    `[mobile-push] scheduler started (every ${intervalMs() / (60 * 60 * 1000)}h)`,
  );
}
