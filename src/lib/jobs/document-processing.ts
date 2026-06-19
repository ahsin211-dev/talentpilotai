import { createServiceClient } from '@/lib/supabase/admin';
import { extractTextFromS3 } from '@/lib/aws/textract';
import { extractWithClaude, mockExtraction } from '@/lib/ai/claude';
import { redactExtractedFields, scrubPiiFromText } from '@/lib/ai/redaction';
import { resolveOccupationCode } from '@/lib/ai/occupation-mapper';
import { enqueueDocumentJob } from '@/lib/queue/client';
import { advanceCaseStage } from '@/lib/case/stages';
import { dispatchEvent } from '@/lib/integrations/dispatcher';
import { writeAuditLog } from '@/lib/audit/log';

interface DocumentRecord {
  id: string;
  candidate_id: string;
  document_type: string;
  s3_bucket: string;
  s3_key: string;
  mime_type: string;
}

/**
 * Queue document for async processing via QStash.
 * Falls back to inline processing when queue is not configured.
 */
export async function queueDocumentProcessing(documentId: string): Promise<{
  jobId: string;
  mode: 'queued' | 'inline';
}> {
  const supabase = createServiceClient();

  const { data: job, error } = await supabase
    .from('document_processing_jobs')
    .insert({
      document_id: documentId,
      status: 'queued',
      job_type: 'full_pipeline',
    })
    .select('id')
    .single();

  if (error) throw error;

  await supabase
    .from('candidate_documents')
    .update({ status: 'processing' })
    .eq('id', documentId);

  await advanceCaseStage(documentId, 'ai_processing', 'document');

  const mode = await enqueueDocumentJob(job.id);

  return { jobId: job.id, mode };
}

/**
 * Full OCR + Claude processing pipeline.
 * Security: runs server-side only with service role.
 */
export async function processDocumentJob(jobId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: job } = await supabase
    .from('document_processing_jobs')
    .select('*, candidate_documents(*)')
    .eq('id', jobId)
    .single();

  if (!job) throw new Error('Job not found');

  const document = job.candidate_documents as DocumentRecord;
  const attemptCount = (job.attempt_count ?? 0) + 1;

  await supabase
    .from('document_processing_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      attempt_count: attemptCount,
      ocr_started_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  try {
    // Step 1: OCR via Textract
    let ocrText = '';
    try {
      ocrText = await extractTextFromS3(document.s3_bucket, document.s3_key);
    } catch (ocrErr) {
      console.error('Textract OCR failed:', ocrErr);
      ocrText = '';
    }

    await supabase
      .from('document_processing_jobs')
      .update({ ocr_completed_at: new Date().toISOString(), ai_started_at: new Date().toISOString() })
      .eq('id', jobId);

    // Step 2: Load occupation codes for mapping
    const { data: occupationCodes } = await supabase
      .from('occupation_codes')
      .select('code, title')
      .eq('is_active', true);

    // Step 3: Claude extraction (or mock in dev without API key)
    const extraction = process.env.ANTHROPIC_API_KEY
      ? await extractWithClaude({
          documentType: document.document_type,
          ocrText,
          occupationCodes: occupationCodes ?? [],
        })
      : mockExtraction(ocrText, document.document_type);

    // Step 4: Occupation code mapping
    const occupation = await resolveOccupationCode(
      extraction.mapped_occupation_code,
      extraction.mapped_occupation_title
    );

    // Step 5: Redact PII from public fields
    const { data: candidate } = await supabase
      .from('candidates')
      .select('given_name, preferred_name')
      .eq('id', document.candidate_id)
      .single();

    const redacted = redactExtractedFields(
      extraction.extracted_fields,
      candidate?.preferred_name,
      candidate?.given_name
    );

    const safeCv = extraction.rewritten_cv
      ? scrubPiiFromText(extraction.rewritten_cv)
      : null;

    // Step 6: Persist AI results (raw + redacted separate)
    await supabase.from('ai_extraction_results').insert({
      document_id: document.id,
      job_id: jobId,
      raw_ocr_text: ocrText,
      raw_ai_output: extraction.raw_ai_output,
      extracted_fields: extraction.extracted_fields,
      redacted_fields: redacted.redacted_fields,
      rewritten_cv: safeCv,
      mapped_occupation_code_id: occupation?.id ?? null,
      confidence_score: extraction.confidence_score,
      model_version: extraction.model_version,
      is_admin_approved: false,
    });

    // Step 7: Create/update draft redacted profile (NOT approved — admin must review)
    await supabase.from('candidate_profiles_public_redacted').upsert(
      {
        candidate_id: document.candidate_id,
        display_name: redacted.display_name,
        headline: extraction.headline ?? `${extraction.extracted_fields.years_experience ?? 0}+ years experience`,
        summary: scrubPiiFromText(extraction.summary ?? safeCv?.slice(0, 500) ?? 'Pending admin review.'),
        occupation_title: occupation?.title ?? extraction.mapped_occupation_title,
        occupation_code_id: occupation?.id ?? null,
        years_experience: (extraction.extracted_fields.years_experience as number) ?? null,
        skills: (extraction.extracted_fields.skills as string[]) ?? [],
        qualifications_summary: Array.isArray(extraction.extracted_fields.qualifications)
          ? (extraction.extracted_fields.qualifications as string[]).join('; ')
          : null,
        is_approved: false,
      },
      { onConflict: 'candidate_id' }
    );

    // Step 8: Update job + document status
    await supabase
      .from('document_processing_jobs')
      .update({
        status: 'completed',
        ai_completed_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    await supabase
      .from('candidate_documents')
      .update({ status: 'review_required' })
      .eq('id', document.id);

    await advanceCaseStage(document.candidate_id, 'admin_review', 'candidate');

    await writeAuditLog({
      action: 'document.ai_processing_completed',
      resourceType: 'document_processing_job',
      resourceId: jobId,
      candidateId: document.candidate_id,
      metadata: {
        confidence_score: extraction.confidence_score,
        review_flags: extraction.review_flags,
        document_type: document.document_type,
      },
    });

    // Step 9: Notify integrations
    await dispatchEvent('document.processed', {
      candidate_id: document.candidate_id,
      document_id: document.id,
      job_id: jobId,
      confidence_score: extraction.confidence_score,
      document_type: document.document_type,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    const maxAttempts = job.max_attempts ?? 3;
    const failed = attemptCount >= maxAttempts;

    await supabase
      .from('document_processing_jobs')
      .update({
        status: failed ? 'failed' : 'queued',
        error_message: errorMessage,
        error_details: { attempt: attemptCount, stack: err instanceof Error ? err.stack : null },
        completed_at: failed ? new Date().toISOString() : null,
      })
      .eq('id', jobId);

    if (failed) {
      await supabase
        .from('candidate_documents')
        .update({ status: 'review_required' })
        .eq('id', document.id);

      await dispatchEvent('document.processing_failed', {
        candidate_id: document.candidate_id,
        document_id: document.id,
        job_id: jobId,
        error: errorMessage,
      });
    }

    throw err;
  }
}

/** Retry a failed document processing job. */
export async function retryDocumentJob(jobId: string): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from('document_processing_jobs')
    .update({ status: 'queued', error_message: null })
    .eq('id', jobId);

  await processDocumentJob(jobId);
}
