import { Client as QStashClient } from "@upstash/qstash";
import { getServerEnv } from "@/lib/env";

export const enqueueDocumentProcessing = async ({
  candidateDocumentId,
  processingJobId,
}: {
  candidateDocumentId: string;
  processingJobId: string;
}) => {
  const env = getServerEnv();
  const qstash = new QStashClient({
    token: env.UPSTASH_QSTASH_TOKEN,
  });

  // This endpoint is intentionally private; use a signed internal route in production.
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/internal/process-document`,
    body: {
      candidateDocumentId,
      processingJobId,
    },
    headers: {
      Authorization: `Bearer ${env.INTERNAL_WORKER_TOKEN}`,
    },
    retries: 5,
  });
};
