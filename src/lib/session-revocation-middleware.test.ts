import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  internalRequestAuthorized,
  internalSessionRevocationToken,
} from "./internal-api-auth";
import { sessionRevokedInMiddleware } from "./session-revocation-middleware";
import { bumpRevocationCache } from "./session-revocation-sync";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const REVOCATIONS_PATH = path.join(
  process.cwd(),
  "data",
  "session-revocation-mw.test.json",
);

describe("session revocation middleware", () => {
  const env = { ...process.env };

  beforeEach(async () => {
    process.env.SESSION_SECRET = "test-secret-minimum-32-characters-long";
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

  it("internal auth token validates header", () => {
    const token = internalSessionRevocationToken();
    expect(token).toBeTruthy();
    expect(internalRequestAuthorized(token)).toBe(true);
    expect(internalRequestAuthorized("wrong")).toBe(false);
  });

  it("sync middleware check sees revoked jti", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    await writeFile(
      REVOCATIONS_PATH,
      JSON.stringify({ "jti-1": exp }),
      "utf8",
    );
    bumpRevocationCache();
    expect(sessionRevokedInMiddleware("jti-1", "u1", 100)).toBe(true);
    expect(sessionRevokedInMiddleware("jti-2", "u1", 100)).toBe(false);
  });
});
