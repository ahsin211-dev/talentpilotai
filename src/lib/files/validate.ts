/**
 * File validation: type, size and magic-byte (content) checks. Never trust the
 * client-supplied MIME type alone — verify the file signature.
 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/** Magic-byte signatures keyed by mime type (first bytes). */
const SIGNATURES: Record<string, number[][]> = {
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF (WEBP container)
  // DOCX/XLSX are ZIP containers (PK\x03\x04); legacy DOC is OLE (D0CF11E0).
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    [0x50, 0x4b, 0x03, 0x04],
  ],
  "application/msword": [[0xd0, 0xcf, 0x11, 0xe0]],
};

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

export function validateFileMeta(params: {
  mimeType: string;
  sizeBytes: number;
}): FileValidationResult {
  if (params.sizeBytes <= 0) return { ok: false, error: "Empty file" };
  if (params.sizeBytes > MAX_FILE_BYTES) {
    return { ok: false, error: `File exceeds ${MAX_FILE_BYTES} byte limit` };
  }
  if (!ALLOWED_MIME_TYPES.has(params.mimeType)) {
    return { ok: false, error: `Unsupported file type: ${params.mimeType}` };
  }
  return { ok: true };
}

/** Verify the leading bytes match the declared MIME type. */
export function validateMagicBytes(mimeType: string, head: Uint8Array): FileValidationResult {
  const sigs = SIGNATURES[mimeType];
  if (!sigs) return { ok: false, error: `No signature known for ${mimeType}` };
  const matches = sigs.some((sig) => sig.every((byte, i) => head[i] === byte));
  if (!matches) {
    return { ok: false, error: "File content does not match declared type" };
  }
  return { ok: true };
}

export function validateFile(params: {
  mimeType: string;
  sizeBytes: number;
  head?: Uint8Array;
}): FileValidationResult {
  const meta = validateFileMeta(params);
  if (!meta.ok) return meta;
  if (params.head) return validateMagicBytes(params.mimeType, params.head);
  return { ok: true };
}
