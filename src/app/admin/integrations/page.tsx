import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RetryWebhooksButton } from '@/components/admin/case-stage-selector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default async function AdminIntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('*')
    .order('name');

  const { data: failedDeliveries } = await supabase
    .from('webhook_deliveries')
    .select('*, webhooks(name, provider)')
    .in('status', ['failed', 'retrying'])
    .order('created_at', { ascending: false })
    .limit(30);

  const integrations = [
    { name: 'WhatsApp Business', env: 'WHATSAPP_BUSINESS_TOKEN', configured: !!process.env.WHATSAPP_BUSINESS_TOKEN },
    { name: 'GoHighLevel', env: 'GOHIGHLEVEL_API_KEY', configured: !!process.env.GOHIGHLEVEL_API_KEY },
    { name: 'Recruitment CRM', env: 'CRM_SYNC_URL', configured: !!process.env.CRM_SYNC_URL },
    { name: 'E-signature', env: 'ESIGNATURE_WEBHOOK_SECRET', configured: !!process.env.ESIGNATURE_WEBHOOK_SECRET },
    { name: 'Anthropic Claude', env: 'ANTHROPIC_API_KEY', configured: !!process.env.ANTHROPIC_API_KEY },
    { name: 'AWS Textract', env: 'AWS_ACCESS_KEY_ID', configured: !!process.env.AWS_ACCESS_KEY_ID },
    { name: 'QStash Jobs', env: 'QSTASH_TOKEN', configured: !!process.env.QSTASH_TOKEN },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-white hover:bg-slate-800">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="font-bold text-xl">Integrations</h1>
          </div>
          <RetryWebhooksButton />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Integration status</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {integrations.map((i) => (
              <Card key={i.name}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{i.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{i.env}</p>
                  </div>
                  <Badge variant={i.configured ? 'success' : 'warning'}>
                    {i.configured ? 'Configured' : 'Not set'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Webhook endpoints</h2>
          <div className="space-y-2">
            {webhooks?.map((wh) => (
              <Card key={wh.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{wh.name}</p>
                    <p className="text-xs text-slate-500">{wh.provider} · {wh.endpoint_url}</p>
                  </div>
                  <Badge variant={wh.is_active ? 'success' : 'default'}>
                    {wh.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {!webhooks?.length && (
              <p className="text-slate-500 text-sm">No webhooks configured. Add rows to the webhooks table in Supabase.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">Failed deliveries</h2>
          <div className="space-y-2">
            {failedDeliveries?.map((d) => (
              <Card key={d.id} className="border-amber-200">
                <CardHeader className="pb-1 pt-3">
                  <CardTitle className="text-sm">
                    {(d.webhooks as { name?: string; provider?: string })?.name ?? 'Webhook'} · {d.event_type}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="text-xs text-red-600">{d.error_message}</p>
                  <p className="text-xs text-slate-500">
                    Attempts: {d.attempt_count} · {formatDate(d.created_at)}
                  </p>
                </CardContent>
              </Card>
            ))}
            {!failedDeliveries?.length && (
              <p className="text-slate-500 text-sm">No failed deliveries.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
