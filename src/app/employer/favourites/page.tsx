import type { RedactedProfile } from '@/types/database';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CandidateCard } from '@/components/employer/candidate-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default async function EmployerFavouritesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: employer } = await supabase
    .from('employer_accounts')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!employer) redirect('/register');

  const { data: favourites } = await supabase
    .from('employer_favourites')
    .select('candidate_id')
    .eq('employer_id', employer.id);

  const candidateIds = favourites?.map((f) => f.candidate_id) ?? [];

  const { data: profiles } = candidateIds.length
    ? await supabase
        .from('candidate_profiles_public_redacted')
        .select('*')
        .in('candidate_id', candidateIds)
        .eq('is_approved', true)
    : { data: [] as RedactedProfile[] };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/employer">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-xl">Favourites</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles?.length ? (
            profiles.map((profile) => (
              <CandidateCard key={profile.id} profile={profile} isFavourite={true} />
            ))
          ) : (
            <p className="text-slate-500 col-span-full text-center py-12">No favourites yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
