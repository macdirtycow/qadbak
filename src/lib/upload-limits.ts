/** Per-file upload caps for the domain file manager (panel-enforced). */
export const UPLOAD_LIMIT_FREE_BYTES = 5 * 1024 ** 3;
export const UPLOAD_LIMIT_PREMIUM_BYTES = 100 * 1024 ** 3;

/** Editor / save-in-panel — unchanged small cap. */
export const UPLOAD_LIMIT_EDITOR_BYTES = 10 * 1024 ** 2;

export function formatUploadLimit(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    const gb = bytes / 1024 ** 3;
    return `${Number.isInteger(gb) ? gb : gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  }
  if (bytes >= 1024 ** 2) {
    const mb = bytes / 1024 ** 2;
    return `${Number.isInteger(mb) ? mb : mb.toFixed(0)} MB`;
  }
  const kb = bytes / 1024;
  return `${Number.isInteger(kb) ? kb : kb.toFixed(0)} KB`;
}

export function maxUploadBytesForPremium(premium: boolean): number {
  return premium ? UPLOAD_LIMIT_PREMIUM_BYTES : UPLOAD_LIMIT_FREE_BYTES;
}
