import { Client } from '@upstash/qstash';

let qstashClient: Client | null = null;

function getQStash(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  if (!qstashClient) qstashClient = new Client({ token });
  return qstashClient;
}

export async function enqueueDocumentJob(jobId: string): Promise<'queued' | 'inline'> {
  const qstash = getQStash();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const internalSecret = process.env.INTERNAL_JOB_SECRET;

  if (!qstash || !appUrl) {
    return 'inline';
  }

  await qstash.publishJSON({
    url: `${appUrl}/api/jobs/process-document`,
    body: { jobId },
    headers: internalSecret
      ? { 'x-internal-job-secret': internalSecret }
      : undefined,
    retries: 3,
  });

  return 'queued';
}

export function verifyJobRequest(request: Request): boolean {
  const internalSecret = process.env.INTERNAL_JOB_SECRET;
  if (internalSecret) {
    return request.headers.get('x-internal-job-secret') === internalSecret;
  }

  // QStash signature verification handled separately when QSTASH_CURRENT_SIGNING_KEY is set
  return process.env.NODE_ENV === 'development';
}
