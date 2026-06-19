'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { writeAuditLog } from '@/lib/audit/log';
import { profileApprovalSchema } from '@/lib/validation/schemas';
import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';

export async function approveProfile(input: unknown) {
  await requireRole(['admin']);

  const parsed = profileApprovalSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const service = createServiceClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: adminUser } = await service
    .from('admin_users')
    .select('id')
    .eq('user_id', user!.id)
    .single();

  if (parsed.data.approved) {
    await service
      .from('candidate_profiles_public_redacted')
      .update({
        is_approved: true,
        approved_by: adminUser?.id,
        approved_at: new Date().toISOString(),
        rejection_reason: null,
        ...(parsed.data.editedFields ?? {}),
      })
      .eq('id', parsed.data.profileId);
  } else {
    await service
      .from('candidate_profiles_public_redacted')
      .update({
        is_approved: false,
        rejection_reason: parsed.data.rejectionReason,
      })
      .eq('id', parsed.data.profileId);
  }

  const { data: profile } = await service
    .from('candidate_profiles_public_redacted')
    .select('candidate_id')
    .eq('id', parsed.data.profileId)
    .single();

  await writeAuditLog({
    actorUserId: user!.id,
    actorRole: 'admin',
    action: parsed.data.approved ? 'profile.approved' : 'profile.rejected',
    resourceType: 'candidate_profile',
    resourceId: parsed.data.profileId,
    candidateId: profile?.candidate_id,
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function approveDocument(documentId: string, approved: boolean, rejectionReason?: string) {
  await requireRole(['admin']);

  const service = createServiceClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: adminUser } = await service
    .from('admin_users')
    .select('id')
    .eq('user_id', user!.id)
    .single();

  await service
    .from('candidate_documents')
    .update({
      status: approved ? 'approved' : 'rejected',
      reviewed_by: adminUser?.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason ?? null,
    })
    .eq('id', documentId);

  const { data: doc } = await service
    .from('candidate_documents')
    .select('candidate_id')
    .eq('id', documentId)
    .single();

  await writeAuditLog({
    actorUserId: user!.id,
    actorRole: 'admin',
    action: approved ? 'document.approved' : 'document.rejected',
    resourceType: 'candidate_document',
    resourceId: documentId,
    candidateId: doc?.candidate_id,
  });

  revalidatePath('/admin');
  return { success: true };
}

export async function createRedactedProfileFromCandidate(candidateId: string) {
  await requireRole(['admin']);

  const service = createServiceClient();

  const { data: candidate } = await service
    .from('candidates')
    .select('*, occupation_codes(code, title)')
    .eq('id', candidateId)
    .single();

  if (!candidate) return { error: 'Candidate not found' };

  const displayName = candidate.preferred_name || candidate.given_name || 'Candidate';

  await service.from('candidate_profiles_public_redacted').upsert({
    candidate_id: candidateId,
    display_name: displayName,
    headline: `${candidate.years_experience ?? 0}+ years experience`,
    summary: 'Profile pending admin review and AI rewrite.',
    occupation_title: (candidate.occupation_codes as { title?: string } | null)?.title,
    occupation_code_id: candidate.occupation_code_id,
    country_of_origin: candidate.country_of_origin,
    years_experience: candidate.years_experience,
    skills: candidate.skills ?? [],
    availability_date: candidate.availability_date,
    is_approved: false,
  }, { onConflict: 'candidate_id' });

  revalidatePath('/admin');
  return { success: true };
}
