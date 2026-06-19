import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { documentUploadSchema } from '@/lib/validation/schemas';
import { buildDocumentKey, createUploadUrl, BUCKET } from '@/lib/aws/s3';
import { queueDocumentProcessing, processDocumentJob } from '@/lib/jobs/document-processing';
import { writeAuditLog } from '@/lib/audit/log';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = documentUploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: candidate } = await supabase
      .from('candidates')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!candidate) {
      return NextResponse.json({ error: 'Complete intake first' }, { status: 400 });
    }

    const s3Key = buildDocumentKey(candidate.id, parsed.data.documentType, parsed.data.filename);
    const uploadUrl = await createUploadUrl({
      key: s3Key,
      mimeType: parsed.data.mimeType,
      fileSizeBytes: parsed.data.fileSizeBytes,
    });

    const service = createServiceClient();
    const { data: document, error } = await service
      .from('candidate_documents')
      .insert({
        candidate_id: candidate.id,
        document_type: parsed.data.documentType,
        status: 'pending',
        access_tier: 'candidate_only',
        original_filename: parsed.data.filename,
        mime_type: parsed.data.mimeType,
        file_size_bytes: parsed.data.fileSizeBytes,
        s3_bucket: BUCKET,
        s3_key: s3Key,
        s3_kms_key_id: process.env.AWS_KMS_KEY_ID,
        uploaded_by: user.id,
      })
      .select('id')
      .single();

    if (error || !document) {
      return NextResponse.json({ error: error?.message ?? 'Failed to create document' }, { status: 500 });
    }

    await writeAuditLog({
      actorUserId: user.id,
      actorRole: 'candidate',
      action: 'document.upload_initiated',
      resourceType: 'candidate_document',
      resourceId: document.id,
      candidateId: candidate.id,
      metadata: { documentType: parsed.data.documentType },
    });

    return NextResponse.json({
      uploadUrl,
      documentId: document.id,
      s3Key,
    });
  } catch (err) {
    console.error('Upload init error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { documentId } = await request.json();
    if (!documentId) {
      return NextResponse.json({ error: 'documentId required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId, mode } = await queueDocumentProcessing(documentId);

    // Inline fallback when QStash is not configured
    if (mode === 'inline') {
      await processDocumentJob(jobId);
    }

    await writeAuditLog({
      actorUserId: user.id,
      actorRole: 'candidate',
      action: 'document.processing_queued',
      resourceType: 'document_processing_job',
      resourceId: jobId,
      metadata: { mode },
    });

    return NextResponse.json({ jobId, status: mode === 'inline' ? 'completed' : 'queued' });
  } catch (err) {
    console.error('Processing queue error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
