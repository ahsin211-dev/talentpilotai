'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { candidateIntakeSchema } from '@/lib/validation/schemas';
import { writeAuditLog } from '@/lib/audit/log';
import { revalidatePath } from 'next/cache';

export async function submitCandidateIntake(formData: FormData) {
  const raw = {
    givenName: formData.get('givenName'),
    preferredName: formData.get('preferredName') || undefined,
    surname: formData.get('surname'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    countryOfOrigin: formData.get('countryOfOrigin'),
    currentLocation: formData.get('currentLocation') || undefined,
    yearsExperience: formData.get('yearsExperience') || undefined,
    skills: formData.get('skills')?.toString().split(',').map((s) => s.trim()).filter(Boolean) ?? [],
    availabilityDate: formData.get('availabilityDate') || undefined,
    consentGiven: formData.get('consentGiven') === 'true',
    consentVersion: 'v1.0',
  };

  const parsed = candidateIntakeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: { _form: ['Not authenticated'] } };

  const service = createServiceClient();

  const { data: intakeStage } = await service
    .from('case_stages')
    .select('id')
    .eq('slug', 'documents_pending')
    .single();

  const { data: candidate, error: candidateError } = await service
    .from('candidates')
    .upsert({
      user_id: user.id,
      given_name: parsed.data.givenName,
      preferred_name: parsed.data.preferredName,
      country_of_origin: parsed.data.countryOfOrigin,
      current_location: parsed.data.currentLocation,
      years_experience: parsed.data.yearsExperience,
      skills: parsed.data.skills,
      availability_date: parsed.data.availabilityDate,
      case_stage_id: intakeStage?.id,
      consent_given_at: new Date().toISOString(),
      consent_version: parsed.data.consentVersion,
      onboarding_completed: true,
    }, { onConflict: 'user_id' })
    .select('id')
    .single();

  if (candidateError || !candidate) {
    return { error: { _form: [candidateError?.message ?? 'Failed to save candidate'] } };
  }

  await service.from('candidate_private_details').upsert({
    candidate_id: candidate.id,
    surname: parsed.data.surname,
    phone: parsed.data.phone,
    email: parsed.data.email,
  }, { onConflict: 'candidate_id' });

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: 'candidate',
    action: 'candidate.intake_completed',
    resourceType: 'candidate',
    resourceId: candidate.id,
    candidateId: candidate.id,
  });

  revalidatePath('/candidate');
  return { success: true, candidateId: candidate.id };
}

export async function respondToUnlockRequest(unlockRequestId: string, approved: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: candidate } = await supabase
    .from('candidates')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!candidate) return { error: 'Candidate not found' };

  const service = createServiceClient();

  const { data: request } = await service
    .from('contact_unlock_requests')
    .select('*')
    .eq('id', unlockRequestId)
    .eq('candidate_id', candidate.id)
    .single();

  if (!request) return { error: 'Request not found' };

  const status = approved ? 'approved' : 'rejected';
  await service
    .from('contact_unlock_requests')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', unlockRequestId);

  if (approved) {
    await service.from('candidate_contact_approvals').upsert({
      candidate_id: candidate.id,
      employer_id: request.employer_id,
      unlock_request_id: unlockRequestId,
      approved_at: new Date().toISOString(),
    }, { onConflict: 'candidate_id,employer_id' });
  }

  await writeAuditLog({
    actorUserId: user.id,
    actorRole: 'candidate',
    action: approved ? 'contact.approved' : 'contact.rejected',
    resourceType: 'contact_unlock_request',
    resourceId: unlockRequestId,
    candidateId: candidate.id,
    employerId: request.employer_id,
  });

  revalidatePath('/candidate');
  return { success: true };
}
