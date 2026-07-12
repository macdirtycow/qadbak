/**
 * Detect panel users whose password matches a known weak value.
 * Keep WEAK_PASSWORDS in sync with src/lib/users.ts.
 */
import bcrypt from "bcryptjs";

export const WEAK_PASSWORDS = ["changeme", "password", "admin123", "password123"];

const MIN_LENGTH = Number(process.env.QADBAK_PASSWORD_MIN_LENGTH ?? "12") || 12;

export function validatePanelPassword(password) {
  const p = String(password ?? "");
  if (p.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }
  if (p.length > 256) {
    return "Password is too long.";
  }
  const lower = p.toLowerCase();
  if (WEAK_PASSWORDS.includes(lower)) {
    return "Choose a stronger password.";
  }
  return null;
}

/** @returns {Promise<Array<{ user: object, matchedWeak: string }>>} */
export async function findWeakPasswordUsers(users) {
  const weak = [];
  for (const user of users) {
    if (!user?.passwordHash) continue;
    for (const candidate of WEAK_PASSWORDS) {
      if (await bcrypt.compare(candidate, user.passwordHash)) {
        weak.push({ user, matchedWeak: candidate });
        break;
      }
    }
  }
  return weak;
}

export async function hashPanelPassword(password) {
  return bcrypt.hash(password, 12);
}
