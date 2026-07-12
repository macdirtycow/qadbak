import { describe, expect, it } from "vitest";
import { secretsEqual, validateNewsletterRedirect } from "@/lib/security-utils";

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
