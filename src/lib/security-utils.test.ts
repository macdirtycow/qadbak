import { describe, expect, it } from "vitest";
import { secretsEqual, validateNewsletterRedirect } from "@/lib/security-utils";
import { assertAllowedAgentUrl } from "./agent-url";
import { assertPathWithinRoot } from "./safe-path";
import path from "node:path";

describe("secretsEqual", () => {
  it("matches equal secrets", () => {
    expect(secretsEqual("abc123", "abc123")).toBe(true);
  });

  it("rejects mismatched secrets", () => {
    expect(secretsEqual("abc123", "abc124")).toBe(false);
  });

  it("rejects different lengths without leaking", () => {
    expect(secretsEqual("short", "much-longer-value")).toBe(false);
  });
});

describe("validateNewsletterRedirect", () => {
  it("allows https URLs", () => {
    expect(validateNewsletterRedirect("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("blocks javascript URLs", () => {
    expect(validateNewsletterRedirect("javascript:alert(1)")).toBeNull();
  });

  it("blocks opaque invalid URLs", () => {
    expect(validateNewsletterRedirect("not-a-url")).toBeNull();
  });
});

describe("assertAllowedAgentUrl", () => {
  it("accepts http(s) origins without credentials", () => {
    expect(assertAllowedAgentUrl("https://node.example.com:9100/")).toBe(
      "https://node.example.com:9100",
    );
  });

  it("rejects metadata hosts", () => {
    expect(() => assertAllowedAgentUrl("http://169.254.169.254/latest")).toThrow(
      /not allowed/i,
    );
  });

  it("rejects embedded credentials", () => {
    expect(() => assertAllowedAgentUrl("http://user:pass@127.0.0.1:9100")).toThrow(
      /credentials/i,
    );
  });
});

describe("assertPathWithinRoot", () => {
  it("keeps bucket files inside root", () => {
    const root = path.join("/tmp", "rate-buckets");
    const file = path.join(root, "login-ip-1.json");
    expect(assertPathWithinRoot(root, file)).toBe(path.resolve(file));
  });

  it("rejects traversal", () => {
    const root = path.join("/tmp", "rate-buckets");
    expect(() =>
      assertPathWithinRoot(root, path.join(root, "..", "etc", "passwd")),
    ).toThrow(/escapes/i);
  });
});
