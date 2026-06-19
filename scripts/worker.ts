/**
 * Local job worker. Polls the /api/worker endpoint (which drains a batch of
 * queued document-processing jobs) on an interval. In production the same
 * endpoint is triggered by Vercel Cron / Upstash QStash instead of this loop.
 *
 *   npm run worker
 *
 * Requires the Next.js server to be running and INTERNAL_WORKER_SECRET to match.
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SECRET = process.env.INTERNAL_WORKER_SECRET ?? "change-me-in-production";
const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? "5000");

async function tick(): Promise<void> {
  try {
    const res = await fetch(`${APP_URL}/api/worker`, {
      method: "POST",
      headers: { "x-worker-secret": SECRET },
    });
    const json = await res.json().catch(() => ({}));
    if (json.processed) console.log(`[worker] processed ${json.processed} job(s)`);
  } catch (err) {
    console.error("[worker] error", (err as Error).message);
  }
}

async function main(): Promise<void> {
  console.log(`[worker] polling ${APP_URL}/api/worker every ${INTERVAL_MS}ms`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await tick();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

void main();
