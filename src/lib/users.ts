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

export function invalidateUsersCache(): void {
  cache = null;
}

export async function saveUsers(users: PanelUser[]): Promise<void> {
  await ensureUsersFile();
  await writeFile(USERS_PATH, JSON.stringify(users, null, 2), "utf8");
  invalidateUsersCache();
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

export async function createClientUser(opts: {
  username: string;
  password: string;
  domains: string[];
}): Promise<PanelUser> {
  const users = await loadUsers();
  const name = opts.username.trim();
  const key = name.toLowerCase();
  if (!key) throw new Error("Client username is required.");
  const existing = users.find((u) => u.username.toLowerCase() === key);
  if (existing) {
    if (existing.role !== "client") {
      throw new Error(`Username already used by an administrator: ${name}`);
    }
    throw new Error(`Panel client already exists: ${name}`);
  }
  const hash = await bcrypt.hash(opts.password, 10);
  const user: PanelUser = {
    id: `client-${Date.now()}`,
    username: name,
    passwordHash: hash,
    role: "client",
    domains: [...opts.domains],
  };
  users.push(user);
  await saveUsers(users);
  return user;
}

export async function findClientForDomain(
  domain: string,
): Promise<PanelUser | undefined> {
  const d = domain.trim().toLowerCase();
  const users = await loadUsers();
  return users.find(
    (u) =>
      u.role === "client" &&
      (u.domains ?? []).some((x) => x.toLowerCase() === d),
  );
}

export async function setClientPassword(
  username: string,
  password: string,
): Promise<PanelUser> {
  const users = await loadUsers();
  const name = username.trim();
  const target = users.find(
    (u) => u.username.toLowerCase() === name.toLowerCase(),
  );
  if (!target) throw new Error(`Panel user not found: ${username}`);
  if (target.role !== "client") {
    throw new Error(`User is not a client account: ${username}`);
  }
  target.passwordHash = await bcrypt.hash(password, 10);
  await saveUsers(users);
  return target;
}

export async function assignDomainToClient(
  username: string,
  domain: string,
): Promise<void> {
  const users = await loadUsers();
  const d = domain.trim().toLowerCase();
  if (!d) throw new Error("Domain is required.");
  for (const u of users) {
    if (!u.domains) u.domains = [];
    u.domains = u.domains.filter((x) => x.toLowerCase() !== d);
  }
  const target = users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
  );
  if (!target) throw new Error(`Panel user not found: ${username}`);
  if (target.role !== "client") {
    throw new Error(`User is not a client account: ${username}`);
  }
  if (!target.domains.some((x) => x.toLowerCase() === d)) {
    target.domains.push(d);
  }
  await saveUsers(users);
}
