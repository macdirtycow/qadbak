import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  findUserIdForRefreshToken,
  rotateMobileRefreshToken,
} from "@/lib/mobile-auth";
import { findUserById } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      refreshToken?: string;
      deviceLabel?: string;
    };
    const refreshToken = body.refreshToken?.trim();
    if (!refreshToken) {
      return jsonError("refreshToken is required.");
    }

    const userId = await findUserIdForRefreshToken(refreshToken);
    if (!userId) {
      return jsonError("Refresh token expired or revoked.", 401);
    }

    const user = await findUserById(userId);
    if (!user) {
      return jsonError("Account no longer exists.", 401);
    }

    const tokens = await rotateMobileRefreshToken(
      refreshToken,
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        domains: user.domains,
      },
      body.deviceLabel,
    );

    await auditLog(user.username, "mobile-refresh");

    return jsonOk({
      ...tokens,
      username: user.username,
      role: user.role,
      domains: user.domains,
    });
  } catch (err) {
    if (err instanceof Error && /expired|revoked|invalid/i.test(err.message)) {
      return jsonError(err.message, 401);
    }
    return handleApiError(err);
  }
}
