import { findUserById } from "./users";
import { verifyTotpCode } from "./totp";
import { requireAdminTerminalStepUp } from "./security-config";

export async function adminTerminalStepUpRequired(
  userId: string,
): Promise<boolean> {
  if (!requireAdminTerminalStepUp()) return false;
  const user = await findUserById(userId);
  return Boolean(user?.totpSecret);
}

export async function verifyAdminTerminalStepUp(
  userId: string,
  totp: string | undefined,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await adminTerminalStepUpRequired(userId))) {
    return { ok: true };
  }
  const code = totp?.trim() ?? "";
  if (!code) {
    return {
      ok: false,
      error: "Enter your authenticator code to open the server terminal.",
    };
  }
  const user = await findUserById(userId);
  if (!user?.totpSecret) {
    return {
      ok: false,
      error:
        "Enable two-factor authentication under Account → Security before using the server terminal.",
    };
  }
  if (!verifyTotpCode(user.totpSecret, code)) {
    return { ok: false, error: "Invalid authenticator code." };
  }
  return { ok: true };
}
