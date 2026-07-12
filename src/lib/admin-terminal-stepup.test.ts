import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { requireAdminTerminalStepUp } from "./security-config";

describe("admin terminal step-up config", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("defaults to required in production", () => {
    const prev = process.env.NODE_ENV;
    process.env = { ...process.env, NODE_ENV: "production" };
    delete process.env.QADBAK_ADMIN_TERMINAL_TOTP;
    expect(requireAdminTerminalStepUp()).toBe(true);
    process.env = { ...process.env, NODE_ENV: prev };
  });

  it("can be disabled explicitly", () => {
    process.env.QADBAK_ADMIN_TERMINAL_TOTP = "false";
    expect(requireAdminTerminalStepUp()).toBe(false);
  });
});
