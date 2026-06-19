import "server-only";

import { Redis } from "@upstash/redis";

import { getServerEnv } from "@/lib/env";

let redis: Redis | undefined;

function getRedis() {
  const env = getServerEnv();

  redis ??= new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN
  });

  return redis;
}

export async function enqueueDocumentProcessingJob(jobId: string) {
  await getRedis().lpush("document-processing:queued", jobId);
}

export type AiExtractionDraft = {
  structuredFields: Record<string, unknown>;
  redactedProfile: Record<string, unknown>;
  confidenceScore: number;
  piiRedactionReport: Record<string, unknown>;
};

export function assertAiOutputRequiresHumanReview(result: AiExtractionDraft) {
  if (!result.redactedProfile || typeof result.confidenceScore !== "number") {
    throw new Error("AI result is incomplete and cannot enter admin review");
  }

  // AI output is intentionally staged only for admin review; publishing happens in admin routes.
  return {
    ...result,
    publishableToEmployers: false
  };
}
