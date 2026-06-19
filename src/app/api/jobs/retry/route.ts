import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { retryDocumentJob } from '@/lib/jobs/document-processing';
import { requireRole } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    await requireRole(['admin']);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { jobId } = await request.json();
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  try {
    await retryDocumentJob(jobId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Retry failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await requireRole(['admin']);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient();
  const { data: jobs } = await service
    .from('document_processing_jobs')
    .select('*, candidate_documents(document_type, candidate_id)')
    .in('status', ['failed', 'queued'])
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ jobs });
}
