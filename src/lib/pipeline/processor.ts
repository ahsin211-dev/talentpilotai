/**
 * Document processing pipeline.
 *
 * Steps (all server-side, never exposed to employers):
 *   1. OCR the stored (encrypted) document            -> Textract / stub
 *   2. Extract structured fields                       -> Claude / heuristic
 *   3. Rewrite to AU professional standard + redact PII
 *   4. Map job title to a standard occupation code
 *   5. Persist RAW output + REDACTED output separately into ai_extraction_results
 *   6. Move the candidate into the admin review stage
 *
 * The RAW output is stored for admin review ONLY. Nothing is published to
 * employers here — that requires explicit admin approval (see admin actions).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { runOcr } from "@/lib/ai/textract";
import { extractFromText } from "@/lib/ai/claude";
import { matchOccupation, type OccupationCodeRow } from "@/lib/ai/occupation";
import { backoffUntil, type JobRow } from "@/lib/queue";
import { logAudit } from "@/lib/audit";

export async function processJob(admin: SupabaseClient, job: JobRow): Promise<void> {
  try {
    await runFullPipeline(admin, job);
    await admin
      .from("document_processing_jobs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", job.id);
  } catch (err) {
    const attempts = job.attempts + 1;
    const dead = attempts >= job.max_attempts;
    await admin
      .from("document_processing_jobs")
      .update({
        status: dead ? "dead_letter" : "failed",
        attempts,
        last_error: (err as Error).message,
        scheduled_at: dead ? undefined : backoffUntil(attempts),
        finished_at: dead ? new Date().toISOString() : undefined,
      })
      .eq("id", job.id);
    if (dead) {
      await logAudit(
        {
          action: "pipeline_job_dead_letter",
          resourceType: "document_processing_jobs",
          resourceId: job.id,
          candidateId: job.candidate_id,
          metadata: { error: (err as Error).message },
        },
        admin,
      );
    }
    throw err;
  }
}

async function runFullPipeline(admin: SupabaseClient, job: JobRow): Promise<void> {
  // Load the document record.
  const { data: doc, error: docErr } = await admin
    .from("candidate_documents")
    .select("id, candidate_id, s3_bucket, s3_key, document_type")
    .eq("id", job.document_id)
    .single();
  if (docErr || !doc) throw new Error(`document_not_found: ${docErr?.message}`);

  // 1. OCR
  const ocr = await runOcr({ bucket: doc.s3_bucket, key: doc.s3_key });

  // 2-4. Extract + rewrite + redact + classify
  const extraction = await extractFromText(ocr.text);

  const { data: codes } = await admin
    .from("occupation_codes")
    .select("id, code, title, aliases")
    .eq("is_active", true);
  const match = matchOccupation(
    extraction.raw.occupationTitle,
    (codes ?? []) as OccupationCodeRow[],
  );

  // 5. Persist RAW + REDACTED separately. raw_output is admin-only.
  const { error: insErr } = await admin.from("ai_extraction_results").insert({
    candidate_id: doc.candidate_id,
    document_id: doc.id,
    job_id: job.id,
    model: extraction.model,
    raw_output: extraction.raw,
    redacted_output: {
      ...extraction.redacted,
      occupationCodeId: match.codeId,
      occupationCode: match.code,
    },
    confidence_score: extraction.confidence,
    suggested_occupation_code_id: match.codeId,
    review_status: "pending",
  });
  if (insErr) throw new Error(`persist_failed: ${insErr.message}`);

  // 6. Advance the case to admin review (requires human approval to publish).
  await admin.from("candidates").update({ status: "in_review", current_stage: "admin_review" }).eq("id", doc.candidate_id);
  await admin.from("case_stages").insert({
    candidate_id: doc.candidate_id,
    stage: "admin_review",
    notes: `AI extraction complete (confidence ${extraction.confidence}, OCR via ${ocr.provider})`,
  });

  await logAudit(
    {
      action: "pipeline_extraction_complete",
      resourceType: "ai_extraction_results",
      resourceId: job.document_id,
      candidateId: doc.candidate_id,
      metadata: { confidence: extraction.confidence, occupation: match.code },
    },
    admin,
  );
}
