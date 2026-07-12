/**
 * Safe chpasswd via stdin — no shell interpolation.
 */
import { spawn } from "node:child_process";

/**
 * @param {string} unixUser
 * @param {string} password
 */
export function chpasswdSafe(unixUser, password) {
  const user = String(unixUser || "").trim();
  if (!user || !/^[a-z][a-z0-9._-]{0,31}$/.test(user)) {
    throw new Error("Invalid unix user for password change.");
  }
  const pass = String(password ?? "");
  if (pass.includes("\n") || pass.includes("\0")) {
    throw new Error("Invalid password characters.");
  }
  return new Promise((resolve, reject) => {
    const proc = spawn("chpasswd", [], { stdio: ["pipe", "ignore", "pipe"] });
    let err = "";
    proc.stderr.on("data", (d) => {
      err += String(d);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(err.trim() || `chpasswd exited ${code}`));
    });
    proc.stdin.write(`${user}:${pass}\n`);
    proc.stdin.end();
  });
}
