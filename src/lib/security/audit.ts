import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditEvent = {
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  accessLevel?: "standard" | "sensitive";
};

export const recordAuditEvent = async ({
  action,
  resourceType,
  resourceId,
  metadata = {},
  accessLevel = "standard",
}: AuditEvent) => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("log_audit_event", {
    p_action: action,
    p_resource_type: resourceType,
    p_resource_id: resourceId ?? null,
    p_metadata: metadata,
    p_access_level: accessLevel,
  });

  if (error) {
    throw new Error(`Failed to write audit event: ${error.message}`);
  }
};
