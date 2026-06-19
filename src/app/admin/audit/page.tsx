import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default async function AdminAuditPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
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
          <h1 className="font-bold text-xl">Audit Logs</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-2">
          {logs?.map((log) => (
            <Card key={log.id}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-sm font-medium text-slate-900">{log.action}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {log.resource_type}
                      {log.resource_id ? ` · ${log.resource_id}` : ''}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500 shrink-0">
                    <p>{formatDate(log.created_at)}</p>
                    <p className="capitalize">{log.actor_role ?? 'system'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {!logs?.length && <p className="text-slate-500">No audit logs yet.</p>}
        </div>
      </main>
    </div>
  );
}
