import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, Bell, LogOut } from 'lucide-react';

export default async function CandidateDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: candidate } = await supabase
    .from('candidates')
    .select('*, case_stages(name, slug)')
    .eq('user_id', user.id)
    .single();

  const { data: documents } = await supabase
    .from('candidate_documents')
    .select('id, document_type, status, created_at')
    .eq('candidate_id', candidate?.id ?? '')
    .order('created_at', { ascending: false });

  const { data: unlockRequests } = await supabase
    .from('contact_unlock_requests')
    .select('id, status, created_at, employer_accounts(company_name)')
    .eq('candidate_id', candidate?.id ?? '')
    .eq('status', 'pending');

  const stageName = (candidate?.case_stages as { name?: string } | null)?.name ?? 'Intake';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-lg text-slate-900">My Application</h1>
            <p className="text-xs text-slate-500">TalentPilot AI</p>
          </div>
          <form action="/api/auth/signout" method="post">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                <LogOut className="h-4 w-4" />
              </Button>
            </Link>
          </form>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Application Status</CardTitle>
              <Badge variant="info">{stageName}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              {candidate?.onboarding_completed
                ? 'Your profile is being reviewed. We will notify you of updates.'
                : 'Complete your intake to begin the application process.'}
            </p>
            {!candidate?.onboarding_completed && (
              <Link href="/candidate/intake" className="block mt-4">
                <Button className="w-full">Complete Intake</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {(unlockRequests?.length ?? 0) > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" />
                <CardTitle className="text-base">Contact Requests</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {unlockRequests?.map((req) => (
                <Link
                  key={req.id}
                  href={`/candidate/requests/${req.id}`}
                  className="block rounded-lg bg-white p-3 border border-amber-200"
                >
                  <p className="text-sm font-medium text-slate-900">
                    {(req.employer_accounts as { company_name?: string })?.company_name ?? 'An employer'}
                  </p>
                  <p className="text-xs text-slate-500">Wants to contact you — tap to respond</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-900">Documents</h2>
            <Link href="/candidate/documents">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </Link>
          </div>
          <div className="space-y-2">
            {documents?.length ? (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <FileText className="h-5 w-5 text-teal-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 capitalize">
                      {doc.document_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(doc.created_at).toLocaleDateString('en-AU')}
                    </p>
                  </div>
                  <Badge
                    variant={
                      doc.status === 'approved'
                        ? 'success'
                        : doc.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {doc.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-sm text-slate-500">No documents uploaded yet</p>
                  <Link href="/candidate/documents" className="block mt-3">
                    <Button size="sm">Upload documents</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 safe-area-pb">
        <div className="max-w-lg mx-auto flex justify-around py-3">
          <Link href="/candidate" className="text-teal-600 text-xs font-medium text-center">
            Home
          </Link>
          <Link href="/candidate/documents" className="text-slate-500 text-xs font-medium text-center">
            Documents
          </Link>
          <Link href="/candidate/intake" className="text-slate-500 text-xs font-medium text-center">
            Profile
          </Link>
        </div>
      </nav>
    </div>
  );
}
