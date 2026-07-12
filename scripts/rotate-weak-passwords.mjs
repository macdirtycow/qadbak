#!/usr/bin/env node
/**
 * Check panel users for default/weak passwords and optionally rotate them.
 *
 * Usage:
 *   node scripts/rotate-weak-passwords.mjs              # check only
 *   node scripts/rotate-weak-passwords.mjs --fix        # prompt per user
 *   node scripts/rotate-weak-passwords.mjs --fix --generate
 *   node scripts/rotate-weak-passwords.mjs --fix --password 'NewSecurePass123!'
 */
import crypto from "node:crypto";
import { chmod, copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  findWeakPasswordUsers,
  hashPanelPassword,
  validatePanelPassword,
  WEAK_PASSWORDS,
} from "./lib/weak-password-check.mjs";

const ROOT = process.env.QADBAK_DIR || process.cwd();
const USERS_PATH = path.join(ROOT, "data", "users.json");
const USERS_MODE = 0o600;

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const generate = args.includes("--generate");
const passwordFlag = args.indexOf("--password");
const sharedPassword =
  passwordFlag >= 0 ? args[passwordFlag + 1] : process.env.QADBAK_NEW_PASSWORD;

function usage() {
  console.error(`Usage:
  node scripts/rotate-weak-passwords.mjs [--fix] [--generate] [--password PASS]

  --fix         Rotate weak passwords (otherwise check only)
  --generate    With --fix: assign a random password per user and print once
  --password    With --fix: use this password for all weak users (min ${process.env.QADBAK_PASSWORD_MIN_LENGTH ?? 12} chars)

Environment:
  QADBAK_DIR              Panel root (default: cwd)
  QADBAK_NEW_PASSWORD       Same as --password`);
}

if (args.includes("-h") || args.includes("--help")) {
  usage();
  process.exit(0);
}

function randomPassword(length = 20) {
  const alphabet =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function promptHidden(label) {
  if (!input.isTTY) {
    throw new Error(`${label}: stdin is not a TTY (use --generate or --password).`);
  }
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(label);
    return answer;
  } finally {
    rl.close();
  }
}

async function promptPassword(username) {
  const pass = await promptHidden(`New password for ${username}: `);
  const confirm = await promptHidden(`Confirm password for ${username}: `);
  if (pass !== confirm) {
    throw new Error(`Passwords do not match for ${username}.`);
  }
  const err = validatePanelPassword(pass);
  if (err) throw new Error(`${username}: ${err}`);
  return pass;
}

async function loadUsers() {
  let raw;
  try {
    raw = await readFile(USERS_PATH, "utf8");
  } catch (e) {
    console.error(`Cannot read ${USERS_PATH}: ${e.message}`);
    process.exit(1);
  }
  const users = JSON.parse(raw);
  if (!Array.isArray(users)) {
    console.error(`${USERS_PATH} must be a JSON array.`);
    process.exit(1);
  }
  return users;
}

async function main() {
  const users = await loadUsers();
  const weak = await findWeakPasswordUsers(users);

  console.log(`Panel users file: ${USERS_PATH}`);
  console.log(`Weak password list: ${WEAK_PASSWORDS.join(", ")}`);
  console.log(`Total users: ${users.length}`);

  if (weak.length === 0) {
    console.log("\nOK — no users with default/weak passwords.");
    process.exit(0);
  }

  console.log(`\nFound ${weak.length} user(s) with weak password(s):\n`);
  for (const { user, matchedWeak } of weak) {
    console.log(`  - ${user.username} (${user.role}) — matches "${matchedWeak}"`);
  }

  if (!fix) {
    console.log("\nRun with --fix to rotate these passwords.");
    process.exit(1);
  }

  if (sharedPassword && !generate) {
    const err = validatePanelPassword(sharedPassword);
    if (err) {
      console.error(`Invalid --password: ${err}`);
      process.exit(1);
    }
  }

  const backup = `${USERS_PATH}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await copyFile(USERS_PATH, backup);
  console.log(`\nBackup: ${backup}`);

  const rotated = [];

  for (const { user } of weak) {
    let newPass;
    if (generate) {
      newPass = randomPassword();
    } else if (sharedPassword) {
      newPass = sharedPassword;
    } else {
      newPass = await promptPassword(user.username);
    }

    user.passwordHash = await hashPanelPassword(newPass);
    rotated.push({ username: user.username, role: user.role, password: newPass });
  }

  await writeFile(USERS_PATH, `${JSON.stringify(users, null, 2)}\n`, "utf8");
  await chmod(USERS_PATH, USERS_MODE).catch(() => undefined);

  console.log("\nUpdated passwords:\n");
  for (const row of rotated) {
    console.log(`  ${row.username} (${row.role}): ${row.password}`);
  }
  console.log("\nStore these credentials securely. Users must sign in again.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
