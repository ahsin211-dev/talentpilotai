/**
 * Audit logging helper. Calls the SECURITY DEFINER `log_audit` RPC so that the
 * audit row is attributed to the current authenticated user. Every sensitive
 * read (signed URL issuance, profile views, contact unlocks) and privileged
 * action should call this.
 */
import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuditEntry {
  action: string;
  resourceType?: string;
  resourceId?: string;
  candidateId?: string;
  employerId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(
  entry: AuditEntry,
  client?: SupabaseClient,
): Promise<void> {
  const supabase = client ?? createSupabaseServerClient();
  let ip: string | undefined;
  let userAgent: string | undefined;
  try {
    const h = headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    userAgent = h.get("user-agent") ?? undefined;
  } catch {
    // headers() unavailable outside request scope (e.g. worker) — that's fine.
  }

  const metadata = { ...(entry.metadata ?? {}), ip, userAgent };

  const { error } = await supabase.rpc("log_audit", {
    p_action: entry.action,
    p_resource_type: entry.resourceType ?? null,
    p_resource_id: entry.resourceId ?? null,
    p_candidate_id: entry.candidateId ?? null,
    p_employer_id: entry.employerId ?? null,
    p_metadata: metadata,
  });

  if (error) {
    // Audit logging must never silently fail in production; surface loudly.
    console.error("audit_log_failed", entry.action, error.message);
  }
}
