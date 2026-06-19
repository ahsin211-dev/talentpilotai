/**
 * OCR via AWS Textract. Falls back to a deterministic stub when AWS is not
 * configured so the full pipeline can be exercised locally and in CI.
 */
import "server-only";
import { serverEnv, isConfigured } from "@/lib/env";

export interface OcrResult {
  text: string;
  provider: "textract" | "stub";
  pages: number;
}

export function isOcrConfigured(): boolean {
  return isConfigured(serverEnv.aws.region, serverEnv.aws.documentsBucket);
}

export async function runOcr(params: {
  bucket: string;
  key: string;
}): Promise<OcrResult> {
  if (!isOcrConfigured()) {
    return {
      provider: "stub",
      pages: 1,
      text: `STUB OCR for s3://${params.bucket}/${params.key}\nJohn Smith\nCarpenter, 8 years experience\nemail: john.smith@example.com phone: +61400000000`,
    };
  }

  // Lazy import keeps the AWS SDK out of bundles that never OCR.
  const { TextractClient, DetectDocumentTextCommand } = await import("@aws-sdk/client-textract");
  const textract = new TextractClient({ region: serverEnv.aws.region });
  const res = await textract.send(
    new DetectDocumentTextCommand({
      Document: { S3Object: { Bucket: params.bucket, Name: params.key } },
    }),
  );
  const text = (res.Blocks ?? [])
    .filter((b) => b.BlockType === "LINE")
    .map((b) => b.Text)
    .join("\n");
  return { provider: "textract", pages: 1, text };
}
