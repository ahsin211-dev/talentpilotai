import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { verifyEsignatureWebhook, parseEsignatureEvent } from '@/lib/integrations/esignature';
import { dispatchEvent } from '@/lib/integrations/dispatcher';
import { writeAuditLog } from '@/lib/audit/log';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-esignature-signature');

  if (!verifyEsignatureWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const event = parseEsignatureEvent(parsed);
  if (!event) {
    return NextResponse.json({ error: 'Invalid event payload' }, { status: 400 });
  }

  const service = createServiceClient();

  if (event.document_id) {
    await service
      .from('candidate_documents')
      .update({ status: 'approved' })
      .eq('id', event.document_id);
  }

  await service
    .from('candidates')
    .update({
      consent_given_at: event.signed_at,
      consent_version: 'esign-v1',
    })
    .eq('id', event.candidate_id);

  await writeAuditLog({
    action: 'consent.esignature_received',
    resourceType: 'candidate',
    resourceId: event.candidate_id,
    candidateId: event.candidate_id,
    metadata: { document_id: event.document_id, signed_at: event.signed_at },
  });

  await dispatchEvent('consent.signed', {
    candidate_id: event.candidate_id,
    document_id: event.document_id,
  });

  return NextResponse.json({ received: true });
}
