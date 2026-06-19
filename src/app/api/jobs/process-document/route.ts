import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { processDocumentJob } from '@/lib/jobs/document-processing';
import { verifyJobRequest } from '@/lib/queue/client';

async function verifyRequest(request: NextRequest, body: string): Promise<boolean> {
  const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  if (signingKey) {
    const receiver = new Receiver({
      currentSigningKey: signingKey,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? '',
    });
    const signature = request.headers.get('upstash-signature') ?? '';
    return receiver.verify({ signature, body });
  }
  return verifyJobRequest(request);
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  const authorized = await verifyRequest(request, body);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let jobId: string;
  try {
    const parsed = JSON.parse(body);
    jobId = parsed.jobId;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  try {
    await processDocumentJob(jobId);
    return NextResponse.json({ success: true, jobId });
  } catch (err) {
    console.error('Document processing failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Processing failed' },
      { status: 500 }
    );
  }
}
