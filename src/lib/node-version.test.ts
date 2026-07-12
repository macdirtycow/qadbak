import { describe, expect, it } from "vitest";
import {
  isNodeVersionSupported,
  nodeVersionError,
  parseNodeMajor,
  QADBAK_MIN_NODE_MAJOR,
} from "./node-version";

describe("node version", () => {
  it("parses semver majors", () => {
    expect(parseNodeMajor("v20.11.0")).toBe(20);
    expect(parseNodeMajor("22.1.0")).toBe(22);
  });

  it("enforces minimum major", () => {
    expect(isNodeVersionSupported("v20.0.0")).toBe(true);
    expect(isNodeVersionSupported("v18.0.0")).toBe(false);
    expect(QADBAK_MIN_NODE_MAJOR).toBe(20);
  });

  it("returns readable errors", () => {
    expect(nodeVersionError("v18.3.0")).toMatch(/20\+/);
    expect(nodeVersionError("v20.0.0")).toBeNull();
  });
});
