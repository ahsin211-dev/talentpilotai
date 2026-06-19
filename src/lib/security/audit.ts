import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

type AuditEvent = {
  actorUserId: string | null;
  actorRole: string;
  action: string;
  targetTable: string;
  targetId: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent(event: AuditEvent) {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_user_id: event.actorUserId,
      actor_role: event.actorRole,
      action: event.action,
      target_table: event.targetTable,
      target_id: event.targetId,
      metadata: event.metadata ?? {}
    });

    if (error) {
      console.error("Audit insert failed", error);
    }
  } catch (error) {
    // Keep privileged flows resilient when secrets are not configured yet.
    console.warn("Audit logging unavailable", error);
  }
}
