import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  bumpRevocationCache,
  isSessionRevokedSync,
  isUserSessionRevokedSync,
  sessionRevokedSync,
} from "./session-revocation-sync";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const REVOCATIONS_PATH = path.join(
  process.cwd(),
  "data",
  "session-revocations-sync.test.json",
);

describe("session-revocation-sync", () => {
  const env = { ...process.env };

  beforeEach(async () => {
    process.env.QADBAK_SESSION_REVOCATIONS_PATH = REVOCATIONS_PATH;
    bumpRevocationCache();
    await mkdir(path.dirname(REVOCATIONS_PATH), { recursive: true });
    await writeFile(REVOCATIONS_PATH, "{}", "utf8");
  });

  afterEach(async () => {
    process.env = { ...env };
    bumpRevocationCache();
    await rm(REVOCATIONS_PATH, { force: true });
  });

  it("detects revoked jti", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    await writeFile(
      REVOCATIONS_PATH,
      JSON.stringify({ "test-jti": exp }),
      "utf8",
    );
    bumpRevocationCache();
    expect(isSessionRevokedSync("test-jti")).toBe(true);
    expect(isSessionRevokedSync("other")).toBe(false);
  });

  it("detects user logout timestamp", async () => {
    const logoutAt = Math.floor(Date.now() / 1000);
    await writeFile(
      REVOCATIONS_PATH,
      JSON.stringify({ "user:admin-1": logoutAt }),
      "utf8",
    );
    bumpRevocationCache();
    expect(isUserSessionRevokedSync("admin-1", logoutAt)).toBe(true);
    expect(isUserSessionRevokedSync("admin-1", logoutAt + 1)).toBe(false);
  });

  it("combines jti and user checks", async () => {
    const now = Math.floor(Date.now() / 1000);
    await writeFile(
      REVOCATIONS_PATH,
      JSON.stringify({ "user:u1": now }),
      "utf8",
    );
    bumpRevocationCache();
    expect(sessionRevokedSync(undefined, "u1", now)).toBe(true);
  });
});
