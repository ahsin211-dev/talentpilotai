import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CaseStageSelector } from '@/components/admin/case-stage-selector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { getCaseStages } from '@/lib/case/stages';

export default async function AdminCasesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const stages = await getCaseStages();

  const { data: candidates } = await supabase
    .from('candidates')
    .select('id, given_name, preferred_name, country_of_origin, onboarding_completed, case_stages(slug, name)')
    .order('updated_at', { ascending: false })
    .limit(100);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-white hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-xl">Case Management</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {candidates?.map((candidate) => {
            const stage = candidate.case_stages as { slug?: string; name?: string } | null;
            const name = candidate.preferred_name || candidate.given_name || 'Candidate';

            return (
              <Card key={candidate.id}>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-slate-500">{candidate.country_of_origin ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={candidate.onboarding_completed ? 'success' : 'warning'}>
                      {stage?.name ?? 'Intake'}
                    </Badge>
                    <CaseStageSelector
                      candidateId={candidate.id}
                      currentStageSlug={stage?.slug}
                      stages={stages}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!candidates?.length && (
            <p className="text-slate-500 text-center py-12">No candidates yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
