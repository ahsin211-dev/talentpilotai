import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-southeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

const BUCKET = process.env.AWS_S3_BUCKET!;
const KMS_KEY_ID = process.env.AWS_KMS_KEY_ID;

export function buildDocumentKey(candidateId: string, documentType: string, filename: string): string {
  const ext = filename.split('.').pop() ?? 'bin';
  return `candidates/${candidateId}/${documentType}/${randomUUID()}.${ext}`;
}

export async function createUploadUrl(params: {
  key: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: params.key,
    ContentType: params.mimeType,
    ContentLength: params.fileSizeBytes,
    ServerSideEncryption: 'aws:kms',
    SSEKMSKeyId: KMS_KEY_ID,
    Metadata: {
      'x-amz-meta-classification': 'sensitive',
    },
  });

  return getSignedUrl(s3, command, { expiresIn: 300 });
}

export async function createDownloadUrl(key: string, expiresIn = 60): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn });
}

export async function verifyObjectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export { BUCKET, KMS_KEY_ID };
