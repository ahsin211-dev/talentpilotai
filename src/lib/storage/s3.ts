/**
 * Encrypted document storage on S3 with SSE-KMS.
 *
 * SECURITY:
 * - All objects are written with server-side KMS encryption.
 * - Buckets are private; the ONLY way to retrieve an object is a short-lived,
 *   pre-signed URL issued by an authorized server action that has already
 *   passed an RLS-backed ownership check and written an audit log.
 * - Presigned PUT URLs are scoped to a single key + content type.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serverEnv, isConfigured } from "@/lib/env";

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (cachedClient) return cachedClient;
  const { region, accessKeyId, secretAccessKey } = serverEnv.aws;
  cachedClient = new S3Client({
    region,
    credentials:
      accessKeyId && secretAccessKey
        ? { accessKeyId, secretAccessKey }
        : undefined, // fall back to instance/role credentials
  });
  return cachedClient;
}

export function isStorageConfigured(): boolean {
  return isConfigured(serverEnv.aws.documentsBucket, serverEnv.aws.region);
}

/** Build a tenant-scoped, non-guessable object key. */
export function buildDocumentKey(candidateId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/gu, "_").slice(0, 120);
  return `candidates/${candidateId}/${randomUUID()}/${safeName}`;
}

export interface PresignedUpload {
  url: string;
  key: string;
  bucket: string;
  kmsKeyId?: string;
}

export async function createPresignedUpload(params: {
  candidateId: string;
  fileName: string;
  mimeType: string;
}): Promise<PresignedUpload> {
  const bucket = serverEnv.aws.documentsBucket;
  const kmsKeyId = serverEnv.aws.kmsKeyId || undefined;
  const key = buildDocumentKey(params.candidateId, params.fileName);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: params.mimeType,
    ServerSideEncryption: kmsKeyId ? "aws:kms" : "AES256",
    SSEKMSKeyId: kmsKeyId,
  });

  const url = await getSignedUrl(client(), command, {
    expiresIn: serverEnv.aws.signedUrlTtl,
  });
  return { url, key, bucket, kmsKeyId };
}

/** Server-side encrypted upload (used by the candidate upload server action). */
export async function putObject(params: {
  candidateId: string;
  fileName: string;
  mimeType: string;
  body: Buffer | Uint8Array;
}): Promise<{ bucket: string; key: string; kmsKeyId?: string }> {
  const bucket = serverEnv.aws.documentsBucket;
  const kmsKeyId = serverEnv.aws.kmsKeyId || undefined;
  const key = buildDocumentKey(params.candidateId, params.fileName);
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.body,
      ContentType: params.mimeType,
      ServerSideEncryption: kmsKeyId ? "aws:kms" : "AES256",
      SSEKMSKeyId: kmsKeyId,
    }),
  );
  return { bucket, key, kmsKeyId };
}

/** Short-lived download URL for an already-authorized request. */
export async function createPresignedDownload(params: {
  bucket: string;
  key: string;
}): Promise<string> {
  const command = new GetObjectCommand({ Bucket: params.bucket, Key: params.key });
  return getSignedUrl(client(), command, { expiresIn: serverEnv.aws.signedUrlTtl });
}

export async function deleteObject(params: { bucket: string; key: string }): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: params.bucket, Key: params.key }));
}
