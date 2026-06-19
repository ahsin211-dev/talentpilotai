import "server-only";

import { headers } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditPayload = {
  action: string;
  targetTable?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(payload: AuditPayload) {
  const headerStore = await headers();
  const supabase = await createSupabaseServerClient();

  const metadata = {
    ...(payload.metadata ?? {}),
    ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: headerStore.get("user-agent") ?? null
  };

  const { error } = await supabase.rpc("write_audit_log", {
    p_action: payload.action,
    p_target_table: payload.targetTable ?? null,
    p_target_id: payload.targetId ?? null,
    p_metadata: metadata
  });

  if (error) {
    throw new Error(`Failed to write audit log: ${error.message}`);
  }
}
