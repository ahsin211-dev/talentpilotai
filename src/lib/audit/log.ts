import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export interface AuditLogEntry {
  actorId?: string;
  actorRole?: UserRole;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Writes an immutable audit log entry via service role.
 * All sensitive data access must call this function.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("audit_logs").insert({
    actor_id: entry.actorId ?? null,
    actor_role: entry.actorRole ?? null,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    metadata: entry.metadata ?? {},
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
  });

  if (error) {
    console.error("[audit] Failed to write audit log:", error.message);
  }
}

export const AuditActions = {
  DOCUMENT_UPLOAD: "document.upload",
  DOCUMENT_VIEW: "document.view",
  DOCUMENT_DOWNLOAD: "document.download",
  PROFILE_VIEW: "profile.view",
  PROFILE_APPROVE: "profile.approve",
  PROFILE_REJECT: "profile.reject",
  CONTACT_UNLOCK_REQUEST: "contact.unlock_request",
  CONTACT_UNLOCK_APPROVE: "contact.unlock_approve",
  CONTACT_UNLOCK_REJECT: "contact.unlock_reject",
  CONTACT_DETAILS_VIEW: "contact.details_view",
  SUBSCRIPTION_CREATE: "subscription.create",
  SUBSCRIPTION_UPDATE: "subscription.update",
  ADMIN_REVIEW: "admin.review",
  LOGIN: "auth.login",
  LOGOUT: "auth.logout",
} as const;
