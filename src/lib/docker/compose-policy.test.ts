import { describe, expect, it } from "vitest";
import { assertComposePolicyYaml } from "./compose-policy";

describe("assertComposePolicyYaml", () => {
  const safe = `
services:
  web:
    image: nginx:alpine
    ports:
      - "127.0.0.1:8080:80"
`;

  it("allows safe compose", () => {
    expect(() => assertComposePolicyYaml(safe)).not.toThrow();
  });

  it("rejects privileged containers", () => {
    const yaml = `${safe}\n    privileged: true`;
    expect(() => assertComposePolicyYaml(yaml)).toThrow(/disallowed/i);
  });

  it("rejects docker.sock mount", () => {
    const yaml = `
services:
  evil:
    image: alpine
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
`;
    expect(() => assertComposePolicyYaml(yaml)).toThrow(/docker\.sock/i);
  });

  it("rejects network_mode host", () => {
    const yaml = `
services:
  evil:
    image: alpine
    network_mode: host
`;
    expect(() => assertComposePolicyYaml(yaml)).toThrow(/disallowed/i);
  });

  it("rejects bind mount of /etc", () => {
    const yaml = `
services:
  evil:
    image: alpine
    volumes:
      - /etc/passwd:/etc/passwd
`;
    expect(() => assertComposePolicyYaml(yaml)).toThrow(/not allowed/i);
  });
});
