import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  revokeAllMobileRefreshTokens,
  revokeMobileRefreshToken,
} from "@/lib/mobile-auth";
import { MOBILE_ACCESS_TTL_SEC } from "@/lib/mobile-auth-constants";
import { markUserLoggedOut, revokeSessionJti } from "@/lib/session-revocation";
import { requireSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as {
      refreshToken?: string;
      allDevices?: boolean;
    };

    if (body.allDevices) {
      await revokeAllMobileRefreshTokens(session.userId);
      await markUserLoggedOut(session.userId);
      await auditLog(session.username, "mobile-logout-all");
      return jsonOk({ ok: true });
    }

    const refreshToken = body.refreshToken?.trim();
    if (!refreshToken) {
      return jsonError("refreshToken or allDevices is required.");
    }

    await revokeMobileRefreshToken(refreshToken);
    if (session.jti) {
      const exp = Math.floor(Date.now() / 1000) + MOBILE_ACCESS_TTL_SEC;
      await revokeSessionJti(session.jti, exp);
    }
    await auditLog(session.username, "mobile-logout");
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
