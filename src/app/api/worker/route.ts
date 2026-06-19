import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { claimNextJob } from "@/lib/queue";
import { processJob } from "@/lib/pipeline/processor";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Worker endpoint — invoked by a Vercel Cron / Upstash QStash schedule.
 * Authenticated with a shared internal secret (constant-time compare). Drains a
 * bounded batch of jobs per invocation so a single run can't exceed the
 * function time budget.
 */
export async function POST(req: NextRequest) {
  const provided = req.headers.get("x-worker-secret") ?? "";
  if (!safeEqual(provided, serverEnv.internalWorkerSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const results: Array<{ id: string; ok: boolean }> = [];
  const BATCH = 10;

  for (let i = 0; i < BATCH; i += 1) {
    const job = await claimNextJob(admin);
    if (!job) break;
    try {
      await processJob(admin, job);
      results.push({ id: job.id, ok: true });
    } catch {
      results.push({ id: job.id, ok: false });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
