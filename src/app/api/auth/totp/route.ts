import { auditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/session";
import {
  generateTotpSecret,
  totpOtpauthUrl,
  verifyTotpCode,
} from "@/lib/totp";
import {
  findUserById,
  setUserTotpSecret,
  verifyPassword,
} from "@/lib/users";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await findUserById(session.userId);
    if (!user) return jsonError("User not found.", 404);
    return jsonOk({
      enabled: Boolean(user.totpSecret),
      username: user.username,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return jsonError("Sign in required.", 401);
    }
    return jsonError("Could not load 2FA status.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await findUserById(session.userId);
    if (!user) return jsonError("User not found.", 404);

    const body = (await request.json()) as {
      action?: string;
      secret?: string;
      code?: string;
      password?: string;
    };

    if (body.action === "begin-setup") {
      if (user.totpSecret) {
        return jsonError("Disable 2FA first before setting up again.");
      }
      const secret = generateTotpSecret();
      return jsonOk({
        secret,
        otpauthUrl: totpOtpauthUrl(user.username, secret),
      });
    }

    if (body.action === "enable") {
      const secret = body.secret?.trim();
      const code = body.code?.trim();
      if (!secret || !code) {
        return jsonError("Secret and authenticator code are required.");
      }
      if (!verifyTotpCode(secret, code)) {
        return jsonError("Invalid authenticator code. Check your device clock.");
      }
      await setUserTotpSecret(user.id, secret);
      await auditLog(user.username, "totp-enable");
      return jsonOk({ enabled: true });
    }

    if (body.action === "disable") {
      if (!user.totpSecret) return jsonOk({ enabled: false });
      const code = body.code?.trim();
      const password = body.password ?? "";
      if (!code || !password) {
        return jsonError("Password and authenticator code are required.");
      }
      if (!(await verifyPassword(user, password))) {
        return jsonError("Incorrect password.");
      }
      if (!verifyTotpCode(user.totpSecret, code)) {
        return jsonError("Invalid authenticator code.");
      }
      await setUserTotpSecret(user.id, null);
      await auditLog(user.username, "totp-disable");
      return jsonOk({ enabled: false });
    }

    return jsonError("Unknown action.");
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return jsonError("Sign in required.", 401);
    }
    return jsonError("2FA request failed.", 500);
  }
}
