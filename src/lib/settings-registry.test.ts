import { describe, expect, it } from "vitest";
import { filterSettings, settingsForRole } from "./settings-registry";

describe("settings registry", () => {
  it("includes account security for clients", () => {
    const entries = settingsForRole("client");
    expect(entries.some((e) => e.href === "/account/security")).toBe(true);
    expect(entries.some((e) => e.href === "/admin/branding")).toBe(false);
  });

  it("searches settings by keyword", () => {
    const entries = settingsForRole("admin");
    const hits = filterSettings(entries, "firewall");
    expect(hits.some((h) => h.href === "/admin/firewall")).toBe(true);
  });
});
