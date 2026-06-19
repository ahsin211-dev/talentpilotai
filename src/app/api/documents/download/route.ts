import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { createDownloadUrl } from '@/lib/aws/s3';
import { writeAuditLog } from '@/lib/audit/log';

export async function GET(request: NextRequest) {
  const documentId = request.nextUrl.searchParams.get('id');
  if (!documentId) {
    return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Employers are NEVER allowed document access via this endpoint
  if (profile?.role === 'employer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: document } = await supabase
    .from('candidate_documents')
    .select('id, s3_key, candidate_id, access_tier')
    .eq('id', documentId)
    .single();

  if (!document) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = await createDownloadUrl(document.s3_key, 120);

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: profile?.role as 'candidate' | 'admin',
    action: 'document.signed_url_issued',
    resourceType: 'candidate_document',
    resourceId: document.id,
    candidateId: document.candidate_id,
  });

  return NextResponse.json({ url, expiresIn: 120 });
}
