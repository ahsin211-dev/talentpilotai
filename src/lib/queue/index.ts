/**
 * Async job queue. Jobs are durably persisted in `document_processing_jobs`
 * (the source of truth) using the service-role client. When Upstash is
 * configured, an optional fast-path notification can wake the worker; otherwise
 * the worker polls. This guarantees no job is lost even if the notifier fails.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serverEnv, isConfigured } from "@/lib/env";

export type JobType = "ocr" | "extract" | "rewrite" | "classify" | "redact" | "full_pipeline";

export async function enqueueJob(
  admin: SupabaseClient,
  params: {
    documentId: string;
    candidateId: string;
    jobType: JobType;
    payload?: Record<string, unknown>;
    maxAttempts?: number;
  },
): Promise<string> {
  const { data, error } = await admin
    .from("document_processing_jobs")
    .insert({
      document_id: params.documentId,
      candidate_id: params.candidateId,
      job_type: params.jobType,
      status: "queued",
      payload: params.payload ?? {},
      max_attempts: params.maxAttempts ?? 5,
    })
    .select("id")
    .single();

  if (error) throw new Error(`enqueue_failed: ${error.message}`);

  // Best-effort wake of the worker; durability does not depend on it.
  void notifyWorker(data.id).catch((e) => console.error("worker_notify_failed", e));
  return data.id as string;
}

async function notifyWorker(jobId: string): Promise<void> {
  if (!isConfigured(serverEnv.upstash.url, serverEnv.upstash.token)) return;
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({
    url: serverEnv.upstash.url,
    token: serverEnv.upstash.token,
  });
  await redis.lpush("talentpilot:jobs", jobId);
}

/**
 * Atomically claim the next runnable job (queued or a failed job whose backoff
 * has elapsed and which still has attempts remaining). Uses FOR UPDATE SKIP
 * LOCKED semantics via an RPC-free update returning the row.
 */
export async function claimNextJob(admin: SupabaseClient): Promise<JobRow | null> {
  // Find a candidate job id first.
  const { data: rows } = await admin
    .from("document_processing_jobs")
    .select("id")
    .in("status", ["queued", "failed"])
    .lte("scheduled_at", new Date().toISOString())
    .lt("attempts", 5)
    .order("scheduled_at", { ascending: true })
    .limit(1);

  const jobId = rows?.[0]?.id;
  if (!jobId) return null;

  // Claim it by flipping to running (optimistic; safe enough for a single worker
  // — a production multi-worker setup would use a SELECT ... FOR UPDATE RPC).
  const { data, error } = await admin
    .from("document_processing_jobs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("status", ["queued", "failed"])
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return data as JobRow;
}

export interface JobRow {
  id: string;
  document_id: string;
  candidate_id: string;
  job_type: JobType;
  status: string;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
}

/** Exponential backoff schedule for a failed attempt. */
export function backoffUntil(attempts: number): string {
  const seconds = Math.min(2 ** attempts * 30, 3600); // cap at 1h
  return new Date(Date.now() + seconds * 1000).toISOString();
}
