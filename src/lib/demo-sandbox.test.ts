import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  demoGlobalToolMock,
  demoSandboxActive,
  demoVmStatusMock,
} from "./demo-sandbox";
import { runGlobalToolForSession } from "./panel-tools";

describe("demo sandbox", () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.QADBAK_DEMO_READ_ONLY = "true";
    process.env.QADBAK_DEMO_USERNAME = "demo";
    process.env.QADBAK_DEMO_SHOWCASE_DOMAIN = "showcase.qadbak.com";
  });

  afterEach(() => {
    process.env = { ...env };
  });

  it("activates only for demo user in read-only mode", () => {
    expect(demoSandboxActive("demo")).toBe(true);
    expect(demoSandboxActive("admin")).toBe(false);
    expect(demoSandboxActive(null)).toBe(false);
  });

  it("awstats mock shows only showcase domain", () => {
    const raw = demoGlobalToolMock("system-awstats-summary");
    expect(raw.domains).toHaveLength(1);
    expect((raw.domains as { domain: string }[])[0]?.domain).toBe(
      "showcase.qadbak.com",
    );
    expect(raw.demoSandbox).toBe(true);
  });

  it("vm-status mock hides production domains", () => {
    const raw = demoVmStatusMock();
    expect(raw.domains).toEqual(["showcase.qadbak.com"]);
    expect(raw.domainCount).toBe(1);
  });

  it("runGlobalToolForSession returns mock for cron on demo user", async () => {
    const raw = await runGlobalToolForSession(
      { username: "demo" },
      "system-cron-list",
    );
    expect((raw as { demoSandbox?: boolean }).demoSandbox).toBe(true);
    expect((raw as { jobs?: unknown[] }).jobs).toHaveLength(1);
  });
});
