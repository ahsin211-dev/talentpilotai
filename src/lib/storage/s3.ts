import "server-only";

import { randomUUID } from "node:crypto";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  MAX_DOCUMENT_SIZE_BYTES,
  allowedDocumentMimeTypes,
  type DocumentUploadRequest
} from "@/lib/domain";
import { getServerEnv } from "@/lib/env";

export async function createDocumentUploadUrl(
  input: DocumentUploadRequest,
  userId: string
) {
  if (!allowedDocumentMimeTypes.includes(input.contentType)) {
    throw new Error("Unsupported file type.");
  }

  if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
    throw new Error("File exceeds allowed size.");
  }

  const env = getServerEnv(["AWS_REGION", "AWS_S3_BUCKET"]);
  const client = new S3Client({ region: env.AWS_REGION });
  const documentKey = `candidate/${input.candidateId}/${input.documentType}/${randomUUID()}-${input.fileName}`;

  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: documentKey,
    ContentType: input.contentType,
    Metadata: {
      uploadedByUserId: userId,
      candidateId: input.candidateId,
      documentType: input.documentType
    },
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: env.AWS_KMS_KEY_ID
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });

  return {
    documentKey,
    uploadUrl
  };
}
