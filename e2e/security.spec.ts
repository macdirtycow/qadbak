import { expect, test } from "@playwright/test";

const ADMIN = { user: "admin", pass: "changeme" };
const CLIENT = { user: "client", pass: "changeme" };

async function loginApi(
  request: import("@playwright/test").APIRequestContext,
  username: string,
  password: string,
) {
  const res = await request.post("/api/auth/login", {
    data: { username, password },
  });
  expect(res.status()).toBe(200);
  return res;
}

test.describe("mobile auth (Bearer)", () => {
  test("login returns tokens and can list domains without Origin", async ({
    request,
  }) => {
    const login = await request.post("/api/auth/mobile", {
      data: { username: ADMIN.user, password: ADMIN.pass, deviceLabel: "e2e" },
    });
    expect(login.status()).toBe(200);
    const body = await login.json();
    if (body.requiresTotp) {
      test.skip();
      return;
    }
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toMatch(/^qmr_/);
    expect(body.tokenType).toBe("Bearer");

    const me = await request.get("/api/mobile/v1/me", {
      headers: { Authorization: `Bearer ${body.accessToken}` },
    });
    expect(me.status()).toBe(200);

    const domains = await request.get("/api/domains", {
      headers: { Authorization: `Bearer ${body.accessToken}` },
    });
    expect(domains.status()).toBe(200);

    const refresh = await request.post("/api/auth/mobile/refresh", {
      data: { refreshToken: body.refreshToken },
    });
    expect(refresh.status()).toBe(200);
    const refreshed = await refresh.json();
    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.accessToken).not.toBe(body.accessToken);
  });

  test("Bearer POST bypasses CSRF Origin check", async ({ request }) => {
    const login = await request.post("/api/auth/mobile", {
      data: { username: ADMIN.user, password: ADMIN.pass },
    });
    const body = await login.json();
    if (body.requiresTotp) {
      test.skip();
      return;
    }
    const res = await request.post("/api/domains/example.com/ssl", {
      headers: { Authorization: `Bearer ${body.accessToken}` },
      data: { host: "example.com" },
    });
    expect(res.status()).not.toBe(403);
  });
});

test.describe("CSRF protection", () => {
  test("blocks mutating API without Origin", async ({ request }) => {
    await loginApi(request, ADMIN.user, ADMIN.pass);
    const res = await request.post("/api/domains", {
      data: { domain: "evil.test", pass: "longpassword123" },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("domain access (mock)", () => {
  test("client cannot list mailboxes on unassigned domain", async ({ request }) => {
    await loginApi(request, CLIENT.user, CLIENT.pass);
    const res = await request.get("/api/domains/demo.test/users");
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(String(body.error ?? "")).toMatch(/not found|no access/i);
  });

  test("client cannot list databases on unassigned domain", async ({ request }) => {
    await loginApi(request, CLIENT.user, CLIENT.pass);
    const res = await request.get("/api/domains/demo.test/databases");
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("admin can list mailboxes on any mock domain", async ({ request }) => {
    await loginApi(request, ADMIN.user, ADMIN.pass);
    const res = await request.get("/api/domains/demo.test/users");
    expect(res.status()).toBe(200);
  });
});

test.describe("legacy panel redirects", () => {
  test("rejects open-redirect style path", async ({ request }) => {
    await loginApi(request, ADMIN.user, ADMIN.pass);
    const res = await request.get(
      "/api/domains/example.com/hosting-embed-link?path=//evil.example/phish",
    );
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("allows file manager path", async ({ request }) => {
    await loginApi(request, ADMIN.user, ADMIN.pass);
    const res = await request.get(
      "/api/domains/example.com/hosting-embed-link?path=/filemin/index.cgi",
    );
    expect([200, 410]).toContain(res.status());
  });
});

test.describe("file path hardening", () => {
  test("rejects path traversal in file content API", async ({ request }) => {
    await loginApi(request, ADMIN.user, ADMIN.pass);
    const res = await request.get(
      "/api/domains/example.com/files/content?path=..%2F..%2Fetc%2Fpasswd",
    );
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});

test.describe("premium messaging on marketing", () => {
  test("HTML mentions free core vs premium multi-tenant", async ({ request }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/one administrator/i);
    expect(html).toMatch(/client logins/i);
    expect(html).toMatch(/offsite/i);
  });

  test("HTML explains app store scope vs Softaculous", async ({ request }) => {
    const res = await request.get("/");
    const html = await res.text();
    expect(html).toMatch(/24 curated apps|24 maintained apps|24 apps you can install/i);
    expect(html).toMatch(/Softaculous/i);
  });
});
