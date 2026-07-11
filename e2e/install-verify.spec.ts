import { expect, test } from "@playwright/test";

/**
 * Runs against the real installed panel (pm2 on :3000).
 * Used by install/qadbak-install.sh via post-install-verify — not mock.
 */
const adminUser = process.env.E2E_ADMIN_USER ?? "admin";
const adminPass = process.env.E2E_ADMIN_PASS ?? "";
const clientUser = process.env.E2E_CLIENT_USER ?? "";
const clientPass = process.env.E2E_CLIENT_PASS ?? "";

test.describe.configure({ mode: "serial" });

async function login(
  page: import("@playwright/test").Page,
  username: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

test("health reports expected provisioner mode", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  if (process.env.E2E_ALLOW_MOCK === "1") {
    expect(body.mock).toBe(true);
  } else {
    expect(body.mock).toBe(false);
  }
});

test("marketing and about pages", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /hosting control panel you run/i }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: /\d+ curated apps/ })).toBeVisible();
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: /about the name qadbak/i }),
  ).toBeVisible();
});

test("admin can sign in and open core routes", async ({ page, request }) => {
  test.skip(!adminPass, "E2E_ADMIN_PASS not set");
  const probe = await request.post("/api/auth/login", {
    data: { username: adminUser, password: adminPass },
  });
  const probeBody = (await probe.json()) as {
    requiresTotp?: boolean;
    error?: string;
  };
  test.skip(
    probeBody.requiresTotp === true,
    "Admin has TOTP enabled — skip browser login E2E",
  );
  test.skip(
    probe.status() === 401,
    "Admin password rejected — set QADBAK_E2E_ADMIN_PASS in .env.local to your real login password",
  );
  if (probe.status() !== 200) {
    throw new Error(
      `Login probe failed (${probe.status()}): ${probeBody.error ?? "unknown"}`,
    );
  }
  await login(page, adminUser, adminPass);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.goto("/domains");
  await expect(page.getByRole("heading", { name: "Domains" })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Server admin" })).toBeVisible();
});

test("client RBAC when client user was created at install", async ({ page }) => {
  test.skip(!clientUser || !clientPass, "No client user from install");
  await login(page, clientUser, clientPass);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard/);
});
