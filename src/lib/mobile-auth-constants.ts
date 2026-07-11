/** Short-lived JWT returned to the iOS app (Authorization: Bearer). */
export const MOBILE_ACCESS_TTL_SEC = 3600;

/** Opaque refresh token lifetime (rotated on each refresh). */
export const MOBILE_REFRESH_TTL_SEC = 60 * 60 * 24 * 90;
