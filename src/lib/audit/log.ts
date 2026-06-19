import { createServiceClient } from '@/lib/supabase/admin';
import type { AppRole } from '@/types/database';
import { headers } from 'next/headers';

export interface AuditLogEntry {
  actorUserId?: string;
  actorRole?: AppRole;
  action: string;
  resourceType: string;
  resourceId?: string;
  candidateId?: string;
  employerId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit log for sensitive access.
 * Uses service client to ensure logs are written even when RLS would block.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const supabase = createServiceClient();
  const headersList = await headers();

  await supabase.from('audit_logs').insert({
    actor_user_id: entry.actorUserId ?? null,
    actor_role: entry.actorRole ?? null,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    candidate_id: entry.candidateId ?? null,
    employer_id: entry.employerId ?? null,
    metadata: entry.metadata ?? {},
    ip_address: headersList.get('x-forwarded-for')?.split(',')[0] ?? null,
    user_agent: headersList.get('user-agent') ?? null,
  });
}
