import { createServiceClient } from '@/lib/supabase/admin';

/**
 * Phase 1 job structure — full OCR + Claude pipeline in Phase 2.
 * Queues document for async processing and creates job record.
 */
export async function queueDocumentProcessing(documentId: string): Promise<string> {
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

  // Phase 2: enqueue to Upstash Redis / QStash for worker processing
  // await enqueueJob('document-processing', { jobId: job.id });

  return job.id;
}

/**
 * Stub processor for Phase 1 — creates placeholder AI result for admin review.
 * Phase 2 replaces with Textract + Claude pipeline.
 */
export async function processDocumentJobStub(jobId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: job } = await supabase
    .from('document_processing_jobs')
    .select('*, candidate_documents(*)')
    .eq('id', jobId)
    .single();

  if (!job) throw new Error('Job not found');

  await supabase
    .from('document_processing_jobs')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', jobId);

  const document = job.candidate_documents as { id: string; document_type: string };

  await supabase.from('ai_extraction_results').insert({
    document_id: document.id,
    job_id: jobId,
    raw_ocr_text: '[Phase 1 stub — OCR pending]',
    raw_ai_output: { status: 'pending_phase_2' },
    extracted_fields: {},
    confidence_score: 0,
    model_version: 'stub-v1',
  });

  await supabase
    .from('document_processing_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  await supabase
    .from('candidate_documents')
    .update({ status: 'review_required' })
    .eq('id', document.id);
}
