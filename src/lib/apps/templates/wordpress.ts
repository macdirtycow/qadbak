/**
 * WordPress app template — first concrete intent.
 *
 * What "install WordPress for client X" means in plain terms:
 *
 *   1. Pick the domain (must already exist).
 *   2. Create a fresh MySQL database with a long generated password.
 *   3. Download the latest WordPress tarball into public_html.
 *   4. Generate strong SALTs + write wp-config.php with the DB creds.
 *   5. Send the admin to /wp-admin/install.php to pick their admin
 *      account.
 *
 * We deliberately stop at the wizard step — WP's own 5-minute install
 * is the gold-standard UX for picking admin credentials and we don't
 * want to fight it. Future iteration can integrate wp-cli for a zero-
 * touch install that also creates the admin user.
 */

import { randomBytes } from "crypto";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";
import type { AppTemplate } from "../types";

export const wordpressTemplate: AppTemplate = {
  id: "wordpress",
  label: "WordPress",
  tagline: "World's most-used CMS · 5 minutes to live site.",
  icon: "🦋",
  description:
    "Creates a fresh MySQL database, downloads the latest WordPress, " +
    "generates strong SALTs and writes wp-config.php. You finish the " +
    "5-minute WordPress install wizard to pick your admin account.",
  etaSeconds: 60,
  inputs: [
    {
      name: "domain",
      label: "Domain",
      type: "domain",
      required: true,
      help: "The domain that will host this WordPress site. Must already exist (create it under Domains first).",
    },
    {
      name: "tablePrefix",
      label: "Table prefix",
      type: "text",
      defaultValue: "wp_",
      pattern: "^[a-zA-Z0-9_]{1,32}$",
      help: "Prefix for WordPress database tables. Use a custom prefix (e.g. 'wp42_') if you intend to share a database across sites.",
    },
  ],
  async install({ input }) {
    const domain = input.domain?.trim().toLowerCase();
    const tablePrefix = (input.tablePrefix || "wp_").trim();
    if (!domain) throw new Error("Domain is required.");
    if (!/^[a-zA-Z0-9_]{1,32}$/.test(tablePrefix)) {
      throw new Error(
        `Invalid table prefix "${tablePrefix}" — must be letters, digits or underscore (max 32 chars).`,
      );
    }

    // DB names in MySQL: max 64 chars, [a-zA-Z0-9_$]. Build a slug.
    const slug = domain.replace(/[^a-z0-9]/gi, "_").slice(0, 32);
    const suffix = randomBytes(3).toString("hex"); // 6 hex chars
    const dbName = `wp_${slug}_${suffix}`.slice(0, 60);
    const dbPass = makeStrongPassword();

    // 1. Database. MySQL user format is decided by provision-db.mjs (currently
    // `${unixUser}_${dbName}` truncated to 32 chars). Don't replicate that here
    // — read it back from the response so we can never get out of sync.
    const dbCreateResult = (await runProvisioningHelper(
      "db-create",
      domain,
      dbName,
      dbPass,
    )) as { user?: string };
    const dbUser = dbCreateResult.user;
    if (!dbUser) {
      throw new Error(
        "db-create did not return a user name (provisioning-helper bug).",
      );
    }

    // 2. + 3. WordPress files + wp-config.php (single native helper)
    const result = (await runProvisioningHelper(
      "app-install-wordpress",
      domain,
      dbName,
      dbUser,
      dbPass,
      tablePrefix,
    )) as {
      installUrl?: string;
      adminUrl?: string;
      target?: string;
    };

    return {
      domain,
      primaryUrl:
        result.installUrl ?? `https://${domain}/wp-admin/install.php`,
      secondaryUrl: result.adminUrl ?? `https://${domain}/wp-admin/`,
      credentials: [
        { label: "Database name", value: dbName, isSecret: false },
        { label: "Database user", value: dbUser, isSecret: false },
        { label: "Database password", value: dbPass, isSecret: true },
        { label: "Table prefix", value: tablePrefix, isSecret: false },
      ],
      postInstall:
        "Open the URL above in your browser to finish the WordPress 5-minute install wizard. You'll pick the admin username, email and password there. Once done, log in at /wp-admin/.",
    };
  },
};

function makeStrongPassword(): string {
  // 24 chars from a URL-safe alphabet → ~144 bits of entropy.
  return randomBytes(18)
    .toString("base64")
    .replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!)
    .slice(0, 24);
}
