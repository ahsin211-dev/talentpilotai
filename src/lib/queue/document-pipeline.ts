import "server-only";

import { Redis } from "@upstash/redis";

import { getServerEnv } from "@/lib/env";

type DocumentJobPayload = {
  candidateId: string;
  documentId: string;
  storageKey: string;
  documentType: string;
};

export async function enqueueDocumentProcessingJob(payload: DocumentJobPayload) {
  const env = getServerEnv([
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN"
  ]);

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN
  });

  await redis.rpush("document-processing-jobs", payload);
}
