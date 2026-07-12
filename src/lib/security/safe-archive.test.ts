import { describe, expect, it } from "vitest";
import {
  assertSafeArchiveMember,
  assertSafeArchiveEntries,
} from "../../../scripts/lib/safe-archive-extract.mjs";

describe("safe archive extract", () => {
  it("rejects parent traversal", () => {
    expect(() => assertSafeArchiveMember("../etc/passwd")).toThrow(
      /traversal/i,
    );
  });

  it("rejects absolute paths", () => {
    expect(() => assertSafeArchiveMember("/etc/passwd")).toThrow(/absolute/i);
  });

  it("allows normal relative paths", () => {
    expect(() => assertSafeArchiveMember("public_html/index.html")).not.toThrow();
  });

  it("rejects mixed traversal in batch", () => {
    expect(() =>
      assertSafeArchiveEntries(["ok.txt", "foo/../../secret"]),
    ).toThrow(/traversal/i);
  });
});
