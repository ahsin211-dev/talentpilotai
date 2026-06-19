import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "@/lib/env";

const UPLOAD_URL_EXPIRY_SECONDS = 60 * 10;

export const createDocumentUploadUrl = async ({
  candidateId,
  documentType,
  mimeType,
  originalFilename,
  checksumSha256,
}: {
  candidateId: string;
  documentType: string;
  mimeType: string;
  originalFilename: string;
  checksumSha256: string;
}) => {
  const env = getServerEnv();
  const extension = originalFilename.split(".").pop()?.toLowerCase() ?? "bin";
  const objectKey = [
    "candidates",
    candidateId,
    "documents",
    documentType,
    `${Date.now()}-${randomUUID()}.${extension}`,
  ].join("/");

  const s3 = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_DOCUMENT_BUCKET,
    Key: objectKey,
    ContentType: mimeType,
    ChecksumSHA256: checksumSha256,
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: env.AWS_S3_KMS_KEY_ID,
  });

  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
  });

  return {
    signedUrl,
    objectKey,
    bucket: env.AWS_S3_DOCUMENT_BUCKET,
    kmsKeyId: env.AWS_S3_KMS_KEY_ID,
    expiresInSeconds: UPLOAD_URL_EXPIRY_SECONDS,
  };
};
