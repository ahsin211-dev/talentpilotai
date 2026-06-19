import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList, FileSearch, Users, Shield } from 'lucide-react';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/login');

  const { count: reviewQueue } = await supabase
    .from('candidate_documents')
    .select('*', { count: 'exact', head: true })
    .in('status', ['review_required', 'processing']);

  const { count: pendingProfiles } = await supabase
    .from('candidate_profiles_public_redacted')
    .select('*', { count: 'exact', head: true })
    .eq('is_approved', false);

  const { count: unlockRequests } = await supabase
    .from('contact_unlock_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: failedJobs } = await supabase
    .from('document_processing_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6" />
            <div>
              <h1 className="font-bold text-lg">Admin Dashboard</h1>
              <p className="text-xs text-slate-400">TalentPilot AI</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Document review</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{reviewQueue ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Pending profiles</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{pendingProfiles ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Unlock requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{unlockRequests ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Failed jobs</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">{failedJobs ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/admin/review">
            <Card className="hover:border-teal-400 transition-colors h-full">
              <CardContent className="pt-6">
                <FileSearch className="h-8 w-8 text-teal-600 mb-3" />
                <h3 className="font-semibold">Review Queue</h3>
                <p className="text-sm text-slate-500 mt-1">Review documents and AI extractions</p>
                {(reviewQueue ?? 0) > 0 && (
                  <Badge variant="warning" className="mt-2">{reviewQueue} pending</Badge>
                )}
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/profiles">
            <Card className="hover:border-teal-400 transition-colors h-full">
              <CardContent className="pt-6">
                <Users className="h-8 w-8 text-teal-600 mb-3" />
                <h3 className="font-semibold">Profile Approval</h3>
                <p className="text-sm text-slate-500 mt-1">Approve redacted profiles for employers</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/audit">
            <Card className="hover:border-teal-400 transition-colors h-full">
              <CardContent className="pt-6">
                <ClipboardList className="h-8 w-8 text-teal-600 mb-3" />
                <h3 className="font-semibold">Audit Logs</h3>
                <p className="text-sm text-slate-500 mt-1">View sensitive access history</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
