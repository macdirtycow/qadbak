import { randomBytes } from "node:crypto";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";
import type { AppCatalogEntry } from "../catalog";
import type { AppTemplate } from "../types";

const POST_INSTALL: Record<string, string> = {
  joomla:
    "Open your site URL and complete the Joomla web installer. Use the database credentials shown below when asked.",
  drupal:
    "Visit /core/install.php (or the installer redirect) and follow Drupal's setup wizard with the database below.",
  nextcloud:
    "Open the site URL, create the admin account, and enter the MySQL credentials from this screen.",
  phpmyadmin:
    "Sign in with an existing MySQL user (often the domain's database user). Do not expose this URL publicly without extra protection.",
  matomo:
    "Run the Matomo setup wizard at your site URL. Choose MySQL and paste the database credentials below.",
  prestashop:
    "Open your shop URL and complete the PrestaShop installer. Use the MySQL credentials below when asked.",
  ghost:
    "Ghost installs with SQLite by default. SSH as the domain user: cd into the install folder, run ghost config url https://your-domain, then ghost setup and ghost start. Proxy port 2368 (Domains → Runtimes or nginx). To use MySQL instead, edit config.production.json after setup.",
  mediawiki:
    "Open your site URL and follow the MediaWiki installer. Use the MySQL credentials below for the database step.",
  moodle:
    "Visit the site URL and complete Moodle's setup wizard. Paste the database credentials from this screen when asked.",
  phpbb:
    "Open install/app.php (or the installer redirect) and create the admin account. Use the MySQL credentials below.",
  opencart:
    "Run the OpenCart web installer at your shop URL. Choose MySQL and use the credentials below.",
  kanboard:
    "Sign in with the default admin / admin and change the password immediately. Configure the database in config.php if prompted.",
  limesurvey:
    "Complete the LimeSurvey installer at your site URL. Use MySQL and the credentials below.",
  grav:
    "Open /admin on your site to create the Grav administrator — no database required.",
  adminer:
    "Open the Adminer URL and sign in with an existing MySQL user. Restrict access (HTTP auth or IP allowlist) — do not leave this public without protection.",
};

function makeStrongPassword(): string {
  return randomBytes(18)
    .toString("base64")
    .replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!)
    .slice(0, 24);
}

function defaultInstallPath(entry: AppCatalogEntry): string {
  if (entry.id === "phpmyadmin") return "public_html/phpmyadmin";
  if (entry.id === "matomo") return "public_html/matomo";
  if (entry.id === "ghost") return "ghost";
  if (entry.id === "nextcloud") return "public_html";
  if (entry.id === "matomo") return "public_html/matomo";
  if (entry.id === "kanboard") return "public_html/kanboard";
  if (entry.id === "limesurvey") return "public_html/limesurvey";
  if (entry.id === "adminer") return "public_html/adminer";
  return "public_html";
}

export function createCatalogTemplate(entry: AppCatalogEntry): AppTemplate {
  return {
    id: entry.id,
    label: entry.label,
    tagline: entry.tagline,
    icon: entry.icon,
    description: entry.desc,
    etaSeconds: entry.etaSeconds ?? 90,
    inputs: [
      {
        name: "domain",
        label: "Domain",
        type: "domain",
        required: true,
        help: "Domain must already exist under Domains.",
      },
      {
        name: "installPath",
        label: "Install directory",
        type: "text",
        defaultValue: defaultInstallPath(entry),
        help: "Path under the domain home, e.g. public_html or public_html/blog",
      },
      {
        name: "forceOverwrite",
        label: "Overwrite placeholder index.html",
        type: "boolean",
        defaultValue: "false",
        help: "Allow install when index.html looks like a real site (use a subfolder if unsure).",
      },
    ],
    async install({ input }) {
      const domain = input.domain?.trim().toLowerCase();
      const installPath = (input.installPath || defaultInstallPath(entry)).trim();
      const force = input.forceOverwrite === "true";
      if (!domain) throw new Error("Domain is required.");

      const credentials: Array<{
        label: string;
        value: string;
        isSecret: boolean;
      }> = [];

      if (entry.requiresDb) {
        const slug = domain.replace(/[^a-z0-9]/gi, "_").slice(0, 24);
        const suffix = randomBytes(3).toString("hex");
        const dbName = `${entry.id.slice(0, 4)}_${slug}_${suffix}`.slice(0, 60);
        const dbPass = makeStrongPassword();
        const dbCreateResult = (await runProvisioningHelper(
          "db-create",
          domain,
          dbName,
          dbPass,
        )) as { user?: string };
        const dbUser = dbCreateResult.user;
        if (!dbUser) {
          throw new Error("db-create did not return a database user.");
        }
        credentials.push(
          { label: "Database name", value: dbName, isSecret: false },
          { label: "Database user", value: dbUser, isSecret: false },
          { label: "Database password", value: dbPass, isSecret: true },
        );
      }

      const scriptResult = (await runProvisioningHelper(
        "script-install",
        domain,
        entry.name,
        installPath,
        force ? "true" : "false",
      )) as {
        adminUrl?: string;
        postInstall?: string[];
      };

      const primaryUrl =
        scriptResult.adminUrl ?? `https://${domain}/`;

      return {
        domain,
        primaryUrl,
        credentials,
        postInstall:
          POST_INSTALL[entry.id] ??
          "Open the site URL and complete the application's web installer.",
      };
    },
  };
}
