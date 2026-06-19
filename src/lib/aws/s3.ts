import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash, randomUUID } from "crypto";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export interface UploadValidation {
  valid: boolean;
  error?: string;
}

export function validateUpload(
  fileName: string,
  mimeType: string,
  sizeBytes: number
): UploadValidation {
  if (sizeBytes > MAX_FILE_SIZE) {
    return { valid: false, error: "File exceeds 10 MB limit" };
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return { valid: false, error: "File type not allowed" };
  }
  const ext = fileName.split(".").pop()?.toLowerCase();
  const allowedExts = ["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"];
  if (!ext || !allowedExts.includes(ext)) {
    return { valid: false, error: "File extension not allowed" };
  }
  return { valid: true };
}

export function generateS3Key(
  candidateId: string,
  documentType: string,
  fileName: string
): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
  const safeName = `${documentType}/${randomUUID()}.${ext}`;
  return `candidates/${candidateId}/${safeName}`;
}

export async function createPresignedUploadUrl(
  key: string,
  mimeType: string,
  expiresIn = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: mimeType,
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: process.env.AWS_KMS_KEY_ID,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function createPresignedDownloadUrl(
  key: string,
  expiresIn = 300
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export function computeChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export { BUCKET, MAX_FILE_SIZE, ALLOWED_MIME_TYPES };
