import { describe, expect, it } from "vitest";
import {
  legacyApiTlsInsecureEnabled,
  resolveLegacyApiUrl,
} from "./legacy-api-tls";

describe("resolveLegacyApiUrl", () => {
  it("downgrades localhost https to http when TLS insecure is enabled", () => {
    const prevUrl = process.env.QADBAK_LEGACY_API_URL;
    const prevTls = process.env.QADBAK_LEGACY_API_TLS_INSECURE;
    process.env.QADBAK_LEGACY_API_URL = "https://127.0.0.1:10000/virtual-server/remote.cgi";
    process.env.QADBAK_LEGACY_API_TLS_INSECURE = "true";
    delete process.env.QADBAK_LEGACY_API_CA_FILE;
    delete process.env.QADBAK_LEGACY_API_TLS_FINGERPRINT;

    expect(legacyApiTlsInsecureEnabled()).toBe(true);
    expect(
      resolveLegacyApiUrl("https://127.0.0.1:10000/virtual-server/remote.cgi"),
    ).toBe("http://127.0.0.1:10000/virtual-server/remote.cgi");

    if (prevUrl === undefined) delete process.env.QADBAK_LEGACY_API_URL;
    else process.env.QADBAK_LEGACY_API_URL = prevUrl;
    if (prevTls === undefined) delete process.env.QADBAK_LEGACY_API_TLS_INSECURE;
    else process.env.QADBAK_LEGACY_API_TLS_INSECURE = prevTls;
  });
});
