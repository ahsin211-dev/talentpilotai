import { createHmac, timingSafeEqual } from 'crypto';

/** Verify e-signature provider webhook signature (HMAC-SHA256). */
export function verifyEsignatureWebhook(
  body: string,
  signature: string | null
): boolean {
  const secret = process.env.ESIGNATURE_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const sig = signature.replace(/^sha256=/, '');

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export interface EsignatureEvent {
  event: 'consent.signed' | 'document.signed';
  candidate_id: string;
  document_id?: string;
  signed_at: string;
}

export function parseEsignatureEvent(body: unknown): EsignatureEvent | null {
  if (!body || typeof body !== 'object') return null;
  const data = body as Record<string, unknown>;

  if (!data.candidate_id || typeof data.candidate_id !== 'string') return null;

  return {
    event: (data.event as EsignatureEvent['event']) ?? 'consent.signed',
    candidate_id: data.candidate_id,
    document_id: data.document_id as string | undefined,
    signed_at: (data.signed_at as string) ?? new Date().toISOString(),
  };
}
