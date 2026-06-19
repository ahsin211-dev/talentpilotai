import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const processDocumentJobSchema = z.object({
  candidateDocumentId: z.string().uuid(),
  processingJobId: z.string().uuid(),
});

export async function POST(req: Request) {
  const env = getServerEnv();
  const authorization = req.headers.get("authorization");
  if (authorization !== `Bearer ${env.INTERNAL_WORKER_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized worker request." }, { status: 401 });
  }

  const body = await req.json();
  const parsed = processDocumentJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { candidateDocumentId, processingJobId } = parsed.data;
  const supabase = createSupabaseAdminClient();

  await supabase
    .from("document_processing_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      attempt_count: 1,
      worker_id: "qstash-worker",
    })
    .eq("id", processingJobId)
    .eq("candidate_document_id", candidateDocumentId);

  // OCR + Claude extraction integration belongs in Phase 2.
  // For MVP, create an admin-reviewable placeholder output that is never auto-published.
  await supabase.from("ai_extraction_results").insert({
    processing_job_id: processingJobId,
    candidate_document_id: candidateDocumentId,
    raw_ocr_payload: { status: "placeholder", provider: "textract" },
    raw_ai_output: { status: "placeholder", provider: "claude" },
    normalized_candidate_output: {},
    redacted_output: {},
    confidence_score: 0,
    requires_human_review: true,
  });

  await supabase
    .from("candidate_documents")
    .update({
      processing_status: "needs_review",
    })
    .eq("id", candidateDocumentId);

  await supabase
    .from("document_processing_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", processingJobId);

  return NextResponse.json({
    status: "queued_for_admin_review",
  });
}
