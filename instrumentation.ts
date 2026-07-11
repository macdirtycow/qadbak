/**
 * Next.js instrumentation hook — runs exactly once on server startup.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * We use this to register long-lived background jobs (currently: the
 * license heartbeat scheduler) without depending on edge cases like
 * route-handler-triggered initialization.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startHeartbeatScheduler } = await import(
    "./src/lib/license-heartbeat-scheduler"
  );
  startHeartbeatScheduler();
  const { startMobilePushScheduler } = await import(
    "./src/lib/mobile-push-scheduler"
  );
  startMobilePushScheduler();
}
