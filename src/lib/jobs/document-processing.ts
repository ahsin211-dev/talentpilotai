import { createAdminClient } from "@/lib/supabase/admin";

export interface ProcessingJobPayload {
  documentId: string;
  candidateId: string;
  jobId: string;
}

/**
 * Queues a document for async processing.
 * Phase 1: creates job record and marks as queued.
 * Phase 2: dispatches to Upstash QStash for OCR + Claude pipeline.
 */
export async function queueDocumentProcessing(
  documentId: string,
  candidateId: string
): Promise<string> {
  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from("document_processing_jobs")
    .insert({
      document_id: documentId,
      status: "queued",
      job_type: "full_pipeline",
    })
    .select("id")
    .single();

  if (error || !job) {
    throw new Error(`Failed to queue processing job: ${error?.message}`);
  }

  await supabase
    .from("candidate_documents")
    .update({ status: "processing" })
    .eq("id", documentId);

  // Phase 2: dispatch to QStash
  if (process.env.QSTASH_TOKEN && process.env.NEXT_PUBLIC_APP_URL) {
    try {
      const { Client } = await import("@upstash/qstash");
      const qstash = new Client({ token: process.env.QSTASH_TOKEN });
      await qstash.publishJSON({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/jobs/process-document`,
        body: { documentId, candidateId, jobId: job.id } satisfies ProcessingJobPayload,
        retries: 3,
      });
    } catch (err) {
      console.error("[jobs] QStash dispatch failed, job remains queued:", err);
    }
  }

  return job.id;
}

/**
 * Phase 2 stub: full OCR + Claude pipeline.
 * Phase 1 returns structured placeholder for admin review queue.
 */
export async function processDocument(payload: ProcessingJobPayload): Promise<void> {
  const supabase = createAdminClient();
  const { documentId, jobId } = payload;

  await supabase
    .from("document_processing_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    const { data: doc } = await supabase
      .from("candidate_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (!doc) throw new Error("Document not found");

    // Phase 2: AWS Textract OCR + Claude extraction
    const extractedFields = {
      document_type: doc.document_type,
      processed_at: new Date().toISOString(),
      status: "awaiting_admin_review",
      note: "Phase 1 placeholder — full AI pipeline in Phase 2",
    };

    const redactedFields = {
      surname: "[REDACTED]",
      email: "[REDACTED]",
      phone: "[REDACTED]",
      passport_number: "[REDACTED]",
      id_number: "[REDACTED]",
      address: "[REDACTED]",
    };

    await supabase.from("ai_extraction_results").insert({
      document_id: documentId,
      job_id: jobId,
      extracted_fields: extractedFields,
      redacted_fields: redactedFields,
      confidence_score: 0,
      is_admin_approved: false,
    });

    await supabase
      .from("candidate_documents")
      .update({ status: "review_required" })
      .eq("id", documentId);

    await supabase
      .from("document_processing_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("document_processing_jobs")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", jobId);

    await supabase
      .from("candidate_documents")
      .update({ status: "pending" })
      .eq("id", documentId);

    throw err;
  }
}
