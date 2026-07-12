import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  revokeAllMobileRefreshTokens,
  revokeMobileRefreshToken,
} from "@/lib/mobile-auth";
import { markUserLoggedOut } from "@/lib/session-revocation";
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
    await auditLog(session.username, "mobile-logout");
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
