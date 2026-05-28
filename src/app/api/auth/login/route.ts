import { auditLog } from "@/lib/audit";
import { checkLoginRateLimit } from "@/lib/api-rate-limit";
import { jsonError, jsonOk } from "@/lib/api";
import { getClientIp } from "@/lib/client-ip";
import {
  applySessionCookie,
  createSession,
  signLoginTotpChallenge,
  verifyLoginTotpChallenge,
} from "@/lib/session";
import { verifyTotpCode } from "@/lib/totp";
import { findUserById, findUserByUsername, verifyPassword } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      loginToken?: string;
      totp?: string;
    };

    const clientIp = (await getClientIp()) ?? "unknown";

    if (body.loginToken && body.totp) {
      const userId = await verifyLoginTotpChallenge(body.loginToken);
      if (!userId) {
        return jsonError("Sign-in challenge expired. Enter password again.", 401);
      }
      const user = await findUserById(userId);
      if (!user?.totpSecret) {
        return jsonError("Two-factor is not enabled for this account.", 401);
      }
      if (!verifyTotpCode(user.totpSecret, body.totp)) {
        await auditLog(user.username, "login-totp-failed", undefined, clientIp);
        return jsonError("Invalid authenticator code.", 401);
      }
      const token = await createSession({
        userId: user.id,
        username: user.username,
        role: user.role,
        domains: user.domains,
      });
      const response = jsonOk({
        username: user.username,
        role: user.role,
        domains: user.domains,
      });
      applySessionCookie(response, token, request);
      await auditLog(user.username, "login");
      return response;
    }

    if (!body.username || !body.password) {
      return jsonError("Username and password are required.");
    }

    const loginRl = await checkLoginRateLimit(clientIp, body.username);
    if (!loginRl.ok) {
      await auditLog(body.username, "login-rate-limited", undefined, clientIp);
      return jsonError(
        `Too many login attempts. Try again in ${loginRl.retryAfterSec ?? 900} seconds.`,
        429,
      );
    }

    const user = await findUserByUsername(body.username);
    if (!user || !(await verifyPassword(user, body.password))) {
      await auditLog(body.username, "login-failed", undefined, clientIp);
      return jsonError("Invalid credentials.", 401);
    }

    if (user.totpSecret) {
      const loginToken = await signLoginTotpChallenge(user.id);
      return jsonOk({ requiresTotp: true, loginToken });
    }

    const token = await createSession({
      userId: user.id,
      username: user.username,
      role: user.role,
      domains: user.domains,
    });

    const response = jsonOk({
      username: user.username,
      role: user.role,
      domains: user.domains,
    });
    applySessionCookie(response, token, request);

    await auditLog(user.username, "login");

    return response;
  } catch (err) {
    if (err instanceof Error && err.message.includes("SESSION_SECRET")) {
      return jsonError(err.message, 500);
    }
    return jsonError("Sign-in failed.", 500);
  }
}
