'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { unlockRequestSchema } from '@/lib/validation/schemas';
import { writeAuditLog } from '@/lib/audit/log';
import { hasActiveSubscription } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { dispatchEvent } from '@/lib/integrations/dispatcher';

export async function requestContactUnlock(input: unknown) {
  const parsed = unlockRequestSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: employer } = await supabase
    .from('employer_accounts')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!employer) return { error: 'Employer account not found' };

  const subscribed = await hasActiveSubscription(employer.id);
  if (!subscribed) return { error: 'Active subscription required' };

  const service = createServiceClient();

  const { error } = await service.from('contact_unlock_requests').upsert({
    employer_id: employer.id,
    candidate_id: parsed.data.candidateId,
    message: parsed.data.message,
    status: 'pending',
  }, { onConflict: 'employer_id,candidate_id' });

  if (error) return { error: error.message };

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: 'employer',
    action: 'contact.unlock_requested',
    resourceType: 'candidate',
    resourceId: parsed.data.candidateId,
    employerId: employer.id,
    candidateId: parsed.data.candidateId,
  });

  await dispatchEvent('contact.unlock_requested', {
    candidate_id: parsed.data.candidateId,
    employer_id: employer.id,
  });

  revalidatePath('/employer');
  return { success: true };
}

export async function toggleFavourite(candidateId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: employer } = await supabase
    .from('employer_accounts')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!employer) return { error: 'Employer not found' };

  const subscribed = await hasActiveSubscription(employer.id);
  if (!subscribed) return { error: 'Active subscription required' };

  const { data: existing } = await supabase
    .from('employer_favourites')
    .select('id')
    .eq('employer_id', employer.id)
    .eq('candidate_id', candidateId)
    .maybeSingle();

  if (existing) {
    await supabase.from('employer_favourites').delete().eq('id', existing.id);
  } else {
    await supabase.from('employer_favourites').insert({
      employer_id: employer.id,
      candidate_id: candidateId,
    });
  }

  revalidatePath('/employer');
  return { success: true };
}
