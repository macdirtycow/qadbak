import { describe, expect, it } from "vitest";
import {
  isSessionRevoked,
  isUserSessionRevoked,
  markUserLoggedOut,
  revokeSessionJti,
} from "./session-revocation";

describe("session-revocation", () => {
  it("revokes by jti until expiry", async () => {
    const jti = `test-jti-${Date.now()}`;
    const exp = Math.floor(Date.now() / 1000) + 3600;
    await revokeSessionJti(jti, exp);
    expect(await isSessionRevoked(jti)).toBe(true);
    expect(await isSessionRevoked("other")).toBe(false);
  });

  it("invalidates sessions after user logout timestamp", async () => {
    const userId = `user-${Date.now()}`;
    const before = Math.floor(Date.now() / 1000) - 10;
    await markUserLoggedOut(userId);
    expect(await isUserSessionRevoked(userId, before)).toBe(true);
    expect(await isUserSessionRevoked(userId, before + 20)).toBe(false);
  });
});
