import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { checkRateLimit, recordRateLimitFailure } from "@/lib/api-rate-limit";
import { getClientIp } from "@/lib/client-ip";
import {
  findUserIdForRefreshToken,
  rotateMobileRefreshToken,
} from "@/lib/mobile-auth";
import { findUserById } from "@/lib/users";

const REFRESH_LIMIT = 30;
const REFRESH_WINDOW_MS = 15 * 60_000;

export async function POST(request: Request) {
  try {
    const clientIp = (await getClientIp()) ?? "unknown";
    const refreshRl = await checkRateLimit(
      `mobile-refresh:${clientIp}`,
      REFRESH_LIMIT,
      REFRESH_WINDOW_MS,
    );
    if (!refreshRl.ok) {
      return jsonError(
        `Too many refresh attempts. Try again in ${refreshRl.retryAfterSec ?? 900} seconds.`,
        429,
      );
    }

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
      await recordRateLimitFailure(
        `mobile-refresh:${clientIp}`,
        REFRESH_LIMIT,
        REFRESH_WINDOW_MS,
      );
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
