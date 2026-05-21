import { defineConfig, devices } from "@playwright/test";

const installVerify = !!process.env.E2E_INSTALL_VERIFY;
const PORT = process.env.E2E_PORT ?? (installVerify ? "3000" : "3099");
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

function ignoredTests(): string[] {
  if (installVerify) return ["**/smoke.spec.ts"];
  return ["**/install-verify.spec.ts"];
}

export default defineConfig({
  testDir: "e2e",
  testIgnore: ignoredTests(),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(installVerify
    ? {}
    : {
        webServer: {
          command: "bash scripts/e2e-webserver.sh",
          url: `${baseURL}/api/health`,
          reuseExistingServer: false,
          timeout: 300_000,
        },
      }),
});
