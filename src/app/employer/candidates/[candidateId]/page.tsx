import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { hasActiveSubscription } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { UnlockRequestButton } from '@/components/employer/unlock-request-button';

export default async function EmployerCandidateDetailPage({
  params,
}: {
  params: { candidateId: string };
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

  const { data: profile } = await supabase
    .from('candidate_profiles_public_redacted')
    .select('*')
    .eq('candidate_id', params.candidateId)
    .eq('is_approved', true)
    .single();

  if (!profile) notFound();

  // Contact details only available with explicit approval (RLS enforced)
  const { data: contact } = await supabase
    .from('employer_candidate_contact_details')
    .select('*')
    .eq('candidate_id', params.candidateId)
    .eq('employer_id', employer.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/employer/candidates">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-xl">{profile.display_name}</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{profile.headline}</CardTitle>
            {profile.occupation_title && (
              <Badge className="w-fit">{profile.occupation_title}</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.summary && <p className="text-slate-600">{profile.summary}</p>}

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">Experience</dt>
                <dd className="font-medium">{profile.years_experience ?? '—'} years</dd>
              </div>
              <div>
                <dt className="text-slate-500">Country</dt>
                <dd className="font-medium">{profile.country_of_origin ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Visa stage</dt>
                <dd className="font-medium">{profile.visa_stage ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Available from</dt>
                <dd className="font-medium">
                  {profile.availability_date
                    ? new Date(profile.availability_date).toLocaleDateString('en-AU')
                    : '—'}
                </dd>
              </div>
            </dl>

            {profile.skills?.length > 0 && (
              <div>
                <p className="text-sm text-slate-500 mb-2">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {profile.skills.map((s: string) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.qualifications_summary && (
              <div>
                <p className="text-sm text-slate-500 mb-1">Qualifications</p>
                <p className="text-sm text-slate-700">{profile.qualifications_summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {contact ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader>
              <CardTitle className="text-base text-emerald-800">Contact details (approved)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>Name:</strong> {profile.display_name} {contact.surname}</p>
              <p><strong>Email:</strong> {contact.email}</p>
              <p><strong>Phone:</strong> {contact.phone}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Contact details are hidden until the candidate approves your request.
              </p>
              <UnlockRequestButton candidateId={params.candidateId} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
