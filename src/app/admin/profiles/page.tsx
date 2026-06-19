import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CreateProfileButton, ProfileApprovalActions } from '@/components/admin/profile-approval-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default async function AdminProfilesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profiles } = await supabase
    .from('candidate_profiles_public_redacted')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: candidatesWithoutProfile } = await supabase
    .from('candidates')
    .select('id, given_name, preferred_name, onboarding_completed')
    .eq('onboarding_completed', true);

  const profileCandidateIds = new Set(profiles?.map((p) => p.candidate_id) ?? []);
  const needsProfile = candidatesWithoutProfile?.filter((c) => !profileCandidateIds.has(c.id)) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-white hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-xl">Profile Approval</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {needsProfile.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Candidates needing redacted profile</h2>
            <div className="space-y-2">
              {needsProfile.map((c) => (
                <Card key={c.id}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <span>{c.preferred_name || c.given_name || c.id}</span>
                    <CreateProfileButton candidateId={c.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-4">Redacted profiles</h2>
          <div className="space-y-3">
            {profiles?.map((profile) => (
              <Card key={profile.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{profile.display_name}</p>
                      <p className="text-sm text-slate-500">{profile.headline}</p>
                      <p className="text-sm text-slate-600 mt-2 line-clamp-2">{profile.summary}</p>
                    </div>
                    <Badge variant={profile.is_approved ? 'success' : 'warning'}>
                      {profile.is_approved ? 'Approved' : 'Pending'}
                    </Badge>
                  </div>
                  {!profile.is_approved && (
                    <ProfileApprovalActions profileId={profile.id} />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
