#!/usr/bin/env node
/**
 * Verify a panel login password against data/users.json (for E2E credential sync).
 * Usage: verify-admin-password.mjs USERNAME PASSWORD
 * Exit 0 if valid, 1 otherwise.
 */
import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const QADBAK_DIR = process.env.QADBAK_DIR || "/opt/qadbak";
const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error("Usage: node scripts/verify-admin-password.mjs USERNAME PASSWORD");
  process.exit(1);
}

const usersPath = path.join(QADBAK_DIR, "data", "users.json");
let users;
try {
  users = JSON.parse(await readFile(usersPath, "utf8"));
} catch (e) {
  console.error(`Cannot read ${usersPath}: ${e.message}`);
  process.exit(1);
}

const user = users.find((u) => u?.username === username);
if (!user?.passwordHash) {
  console.error(`User not found: ${username}`);
  process.exit(1);
}

const ok = await bcrypt.compare(password, user.passwordHash);
if (!ok) {
  console.error(`Password does not match users.json for ${username}`);
  process.exit(1);
}

if (user.totpSecret) {
  console.error(
    `User ${username} has TOTP enabled — install E2E cannot sign in without an authenticator code`,
  );
  process.exit(1);
}

console.log(`OK — password matches users.json for ${username}`);
