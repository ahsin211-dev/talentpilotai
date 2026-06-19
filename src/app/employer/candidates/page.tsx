import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { hasActiveSubscription } from '@/lib/auth/session';
import { CandidateCard } from '@/components/employer/candidate-card';
import { Suspense } from 'react';
import { CandidateSearch } from '@/components/employer/candidate-search';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default async function EmployerCandidatesPage({
  searchParams,
}: {
  searchParams: { occupation?: string; country?: string; minExperience?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: employer } = await supabase
    .from('employer_accounts')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!employer) redirect('/register');

  const subscribed = await hasActiveSubscription(employer.id);
  if (!subscribed) redirect('/employer/billing');

  let query = supabase
    .from('candidate_profiles_public_redacted')
    .select('*')
    .eq('is_approved', true)
    .order('updated_at', { ascending: false });

  if (searchParams.occupation) {
    query = query.ilike('occupation_title', `%${searchParams.occupation}%`);
  }
  if (searchParams.country) {
    query = query.ilike('country_of_origin', `%${searchParams.country}%`);
  }
  if (searchParams.minExperience) {
    query = query.gte('years_experience', parseInt(searchParams.minExperience, 10));
  }

  const { data: profiles } = await query.limit(50);

  const { data: favourites } = await supabase
    .from('employer_favourites')
    .select('candidate_id')
    .eq('employer_id', employer.id);

  const favouriteIds = new Set(favourites?.map((f) => f.candidate_id) ?? []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/employer">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-xl text-slate-900">Browse Candidates</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Suspense fallback={<div className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />}>
          <CandidateSearch />
        </Suspense>

        <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles?.length ? (
            profiles.map((profile) => (
              <CandidateCard
                key={profile.id}
                profile={profile}
                isFavourite={favouriteIds.has(profile.candidate_id)}
              />
            ))
          ) : (
            <p className="text-slate-500 col-span-full text-center py-12">
              No approved candidates match your search.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
