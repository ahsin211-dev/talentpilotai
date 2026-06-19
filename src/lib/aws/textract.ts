import {
  TextractClient,
  DetectDocumentTextCommand,
  type Block,
} from '@aws-sdk/client-textract';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';

const textract = new TextractClient({
  region: process.env.AWS_TEXTRACT_REGION ?? process.env.AWS_REGION ?? 'ap-southeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-southeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

function blocksToText(blocks: Block[]): string {
  return blocks
    .filter((b) => b.BlockType === 'LINE' && b.Text)
    .map((b) => b.Text!)
    .join('\n');
}

/** Extract text from a document stored in S3 using AWS Textract. */
export async function extractTextFromS3(bucket: string, key: string): Promise<string> {
  const command = new DetectDocumentTextCommand({
    Document: { S3Object: { Bucket: bucket, Name: key } },
  });

  const response = await textract.send(command);
  const text = blocksToText(response.Blocks ?? []);

  if (text.trim()) return text;

  // Fallback for unsupported formats: read raw bytes (text-based docs)
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await obj.Body?.transformToString();
  return body ?? '';
}
