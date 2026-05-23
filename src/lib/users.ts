import bcrypt from "bcryptjs";
import { copyFile, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { PanelUser } from "./types";

const USERS_PATH = path.join(process.cwd(), "data", "users.json");
const EXAMPLE_PATH = path.join(process.cwd(), "data", "users.example.json");

let cache: PanelUser[] | null = null;

async function ensureUsersFile(): Promise<void> {
  try {
    await readFile(USERS_PATH, "utf8");
    return;
  } catch {
    // fall through
  }
  await mkdir(path.dirname(USERS_PATH), { recursive: true });
  try {
    await copyFile(EXAMPLE_PATH, USERS_PATH);
  } catch {
    const hash = await bcrypt.hash("changeme", 10);
    const seed: PanelUser[] = [
      {
        id: "admin-1",
        username: "admin",
        passwordHash: hash,
        role: "admin",
        domains: [],
      },
      {
        id: "client-1",
        username: "client",
        passwordHash: hash,
        role: "client",
        domains: ["example.com"],
      },
    ];
    await writeFile(USERS_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
}

export async function loadUsers(): Promise<PanelUser[]> {
  if (cache) return cache;
  await ensureUsersFile();
  const raw = await readFile(USERS_PATH, "utf8");
  cache = JSON.parse(raw) as PanelUser[];
  return cache;
}

export async function findUserByUsername(
  username: string,
): Promise<PanelUser | undefined> {
  const users = await loadUsers();
  return users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase(),
  );
}

export async function verifyPassword(
  user: PanelUser,
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}
