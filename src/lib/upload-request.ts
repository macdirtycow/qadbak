import { PanelError } from "@/lib/errors";

/** Parse multipart FormData with a clear error when the body was truncated. */
export async function readUploadFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/unexpected end of form|form data|body|aborted|limit/i.test(msg)) {
      throw new PanelError(
        "Upload was truncated or incomplete (often a reverse-proxy or Next.js body size limit). On the server run: sudo bash /opt/qadbak/scripts/update-qadbak.sh — and ensure nginx client_max_body_size is 0 for the panel.",
      );
    }
    throw err;
  }
}

/** Accept File or named Blob from multipart (Node FormData quirks). */
export function asUploadFile(item: FormDataEntryValue): File | null {
  if (typeof File !== "undefined" && item instanceof File) return item;
  if (
    typeof Blob !== "undefined" &&
    item instanceof Blob &&
    typeof (item as Blob & { name?: unknown }).name === "string"
  ) {
    return item as File;
  }
  return null;
}
