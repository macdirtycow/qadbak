import { describe, expect, it } from "vitest";
import {
  assertComposeProject,
  assertComposeYaml,
  assertContainerId,
  assertImageRef,
} from "./validate";

describe("docker input validation", () => {
  it("accepts valid container ids", () => {
    expect(() => assertContainerId("abc123def456")).not.toThrow();
  });

  it("rejects invalid container ids", () => {
    expect(() => assertContainerId("rm -rf")).toThrow();
    expect(() => assertContainerId("")).toThrow();
  });

  it("accepts safe image refs", () => {
    expect(() => assertImageRef("nginx:alpine")).not.toThrow();
  });

  it("rejects shell metacharacters in image refs", () => {
    expect(() => assertImageRef("nginx;id")).toThrow();
  });

  it("requires services in compose yaml", () => {
    expect(() => assertComposeYaml("hello: world")).toThrow();
    expect(() =>
      assertComposeYaml("services:\n  web:\n    image: nginx"),
    ).not.toThrow();
  });

  it("validates compose project names", () => {
    expect(() => assertComposeProject("my-app_1")).not.toThrow();
    expect(() => assertComposeProject("1bad")).toThrow();
  });
});
