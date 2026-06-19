import "server-only";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getServerEnv } from "@/lib/env";

let cachedClient: S3Client | undefined;

function getS3Client() {
  const env = getServerEnv();

  cachedClient ??= new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    }
  });

  return cachedClient;
}

export function buildCandidateDocumentKey(candidateId: string, documentId: string, filename: string) {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  return `candidate-documents/${candidateId}/${documentId}/${safeFilename}`;
}

export async function createEncryptedPutUrl(input: {
  s3Key: string;
  contentType: string;
  byteSize: number;
  checksumSha256?: string;
}) {
  const env = getServerEnv();
  const command = new PutObjectCommand({
    Bucket: env.S3_DOCUMENT_BUCKET,
    Key: input.s3Key,
    ContentType: input.contentType,
    ContentLength: input.byteSize,
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: env.S3_KMS_KEY_ID,
    Metadata: {
      access_tier: "private"
    }
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: 10 * 60 });
}

export async function createSensitiveReadUrl(s3Key: string) {
  const env = getServerEnv();
  const command = new GetObjectCommand({
    Bucket: env.S3_DOCUMENT_BUCKET,
    Key: s3Key
  });

  return getSignedUrl(getS3Client(), command, { expiresIn: 5 * 60 });
}
