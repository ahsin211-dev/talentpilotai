import { NextRequest, NextResponse } from "next/server";
import { processDocument, type ProcessingJobPayload } from "@/lib/jobs/document-processing";

export async function POST(request: NextRequest) {
  // Verify QStash signature in production
  const body = (await request.json()) as ProcessingJobPayload;

  if (!body.documentId || !body.jobId) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await processDocument(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
