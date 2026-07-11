import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  registerMobilePushToken,
  unregisterAllMobilePushTokens,
  unregisterMobilePushToken,
} from "@/lib/mobile-push";
import { requireSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as {
      token?: string;
      bundleId?: string;
      deviceLabel?: string;
    };
    const token = body.token?.trim();
    if (!token) {
      return jsonError("token is required.");
    }
    const record = await registerMobilePushToken({
      userId: session.userId,
      token,
      bundleId: body.bundleId,
      deviceLabel: body.deviceLabel,
    });
    return jsonOk({ ok: true, id: record.id });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as {
      token?: string;
      allDevices?: boolean;
    };
    if (body.allDevices) {
      await unregisterAllMobilePushTokens(session.userId);
      return jsonOk({ ok: true });
    }
    const token = body.token?.trim();
    if (!token) {
      return jsonError("token or allDevices is required.");
    }
    await unregisterMobilePushToken(session.userId, token);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
