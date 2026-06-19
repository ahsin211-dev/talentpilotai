import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { hasActiveSubscription } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase, Heart, CreditCard, Search } from 'lucide-react';

export default async function EmployerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: employer } = await supabase
    .from('employer_accounts')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!employer) redirect('/register');

  const subscribed = await hasActiveSubscription(employer.id);

  const { count: profileCount } = await supabase
    .from('candidate_profiles_public_redacted')
    .select('*', { count: 'exact', head: true })
    .eq('is_approved', true);

  const { count: favouritesCount } = await supabase
    .from('employer_favourites')
    .select('*', { count: 'exact', head: true })
    .eq('employer_id', employer.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-slate-900">{employer.company_name}</h1>
              <p className="text-xs text-slate-500">Employer Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!subscribed && (
              <Link href="/employer/billing">
                <Button size="sm">Subscribe to browse</Button>
              </Link>
            )}
            {subscribed && <Badge variant="success">Active subscription</Badge>}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!subscribed && (
          <Card className="mb-8 border-amber-200 bg-amber-50">
            <CardContent className="py-4 flex items-center justify-between">
              <p className="text-sm text-amber-800">
                Subscribe to browse redacted candidate profiles and request contact access.
              </p>
              <Link href="/employer/billing">
                <Button size="sm">View plans</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Available candidates</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{profileCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Saved favourites</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-900">{favouritesCount ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-slate-900">
                {subscribed ? 'Active' : 'Inactive'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/employer/candidates">
            <Card className="hover:border-teal-300 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6">
                <Search className="h-8 w-8 text-teal-600 mb-3" />
                <h3 className="font-semibold text-slate-900">Browse candidates</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Search approved, redacted profiles by skills and occupation
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/employer/favourites">
            <Card className="hover:border-teal-300 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6">
                <Heart className="h-8 w-8 text-teal-600 mb-3" />
                <h3 className="font-semibold text-slate-900">Favourites</h3>
                <p className="text-sm text-slate-500 mt-1">View saved candidates</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/employer/billing">
            <Card className="hover:border-teal-300 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6">
                <CreditCard className="h-8 w-8 text-teal-600 mb-3" />
                <h3 className="font-semibold text-slate-900">Billing</h3>
                <p className="text-sm text-slate-500 mt-1">Manage subscription</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
