import { createClient } from '@/lib/supabase/server';
import type { AppRole } from '@/types/database';

export async function getSessionUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getUserProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile ? { user, profile } : null;
}

export async function requireRole(allowedRoles: AppRole[]) {
  const result = await getUserProfile();
  if (!result) {
    throw new Error('Unauthorized');
  }
  if (!allowedRoles.includes(result.profile.role)) {
    throw new Error('Forbidden');
  }
  return result;
}

export async function getCandidateForUser(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('candidates')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function getEmployerForUser(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('employer_accounts')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function hasActiveSubscription(employerId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('employer_id', employerId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();
  return !!data;
}
