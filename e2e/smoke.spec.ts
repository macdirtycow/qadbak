import { expect, test } from "@playwright/test";

const ADMIN = { user: "admin", pass: "changeme" };
const CLIENT = { user: "client", pass: "changeme" };

async function login(
  page: import("@playwright/test").Page,
  username: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe("public", () => {
  test("health API returns ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.mock).toBe(true);
  });

  test("login sets session cookie without Secure on http", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { username: "admin", password: "changeme" },
    });
    expect(res.status()).toBe(200);
    const setCookie = res.headers()["set-cookie"] ?? "";
    expect(setCookie).toContain("panel_session=");
    expect(setCookie).not.toContain("Secure");
  });

  test("marketing home loads", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /hosting control panel you run/i }),
    ).toBeVisible();
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: /about the name qadbak/i })).toBeVisible();
  });
});

test.describe("admin", () => {
  test("login and see mock domains on dashboard", async ({ page }) => {
    await login(page, ADMIN.user, ADMIN.pass);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "example.com" })).toBeVisible();
    await expect(page.getByRole("link", { name: "demo.test" })).toBeVisible();
  });

  test("domains list page", async ({ page }) => {
    await login(page, ADMIN.user, ADMIN.pass);
    await page.goto("/domains");
    await expect(page.getByRole("heading", { name: "Domains" })).toBeVisible();
    await expect(page.getByText("example.com")).toBeVisible();
  });

  test("server admin area loads", async ({ page }) => {
    await login(page, ADMIN.user, ADMIN.pass);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Server admin" })).toBeVisible();
  });

  test("networking page loads", async ({ page }) => {
    await login(page, ADMIN.user, ADMIN.pass);
    await page.goto("/admin/networking");
    await expect(page.getByRole("heading", { name: "Networking" })).toBeVisible();
  });

  test("app store loads installable apps", async ({ page }) => {
    await login(page, ADMIN.user, ADMIN.pass);
    await page.goto("/admin/apps");
    await expect(page.getByRole("heading", { name: "App store" })).toBeVisible();
    await expect(page.getByText(/installable apps/i)).toBeVisible();
  });
});

test.describe("client RBAC", () => {
  test("sees only assigned domain", async ({ page }) => {
    await login(page, CLIENT.user, CLIENT.pass);
    await expect(page.getByRole("link", { name: "example.com" })).toBeVisible();
    await expect(page.getByRole("link", { name: "demo.test" })).toHaveCount(0);
  });

  test("cannot access server admin", async ({ page }) => {
    await login(page, CLIENT.user, CLIENT.pass);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
