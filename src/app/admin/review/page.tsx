import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DocumentReviewActions } from '@/components/admin/document-review-actions';
import { AiExtractionEditor } from '@/components/admin/ai-extraction-editor';
import { RetryJobButton } from '@/components/admin/case-stage-selector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { confidenceLabel } from '@/lib/ai/confidence';

export default async function AdminReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: documents } = await supabase
    .from('candidate_documents')
    .select('*, candidates(given_name, preferred_name)')
    .in('status', ['review_required', 'processing', 'pending'])
    .order('created_at', { ascending: true });

  const { data: aiResults } = await supabase
    .from('ai_extraction_results')
    .select('*, candidate_documents(document_type, candidate_id)')
    .eq('is_admin_approved', false)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: failedJobs } = await supabase
    .from('document_processing_jobs')
    .select('id, status, error_message, attempt_count, created_at')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="text-white hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="font-bold text-xl">Review Queue</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {failedJobs && failedJobs.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 text-red-700">Failed processing jobs</h2>
            <div className="space-y-2">
              {failedJobs.map((job) => (
                <Card key={job.id} className="border-red-200">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono">{job.id.slice(0, 8)}…</p>
                      <p className="text-xs text-red-600">{job.error_message}</p>
                      <p className="text-xs text-slate-500">Attempts: {job.attempt_count}</p>
                    </div>
                    <RetryJobButton jobId={job.id} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold mb-4">Documents pending review</h2>
          <div className="space-y-3">
            {documents?.length ? (
              documents.map((doc) => {
                const candidate = doc.candidates as { given_name?: string; preferred_name?: string } | null;
                const name = candidate?.preferred_name || candidate?.given_name || 'Candidate';

                return (
                  <Card key={doc.id}>
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium capitalize">
                          {doc.document_type.replace('_', ' ')} — {name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {doc.original_filename} · {formatDate(doc.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning">{doc.status}</Badge>
                        <DocumentReviewActions documentId={doc.id} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <p className="text-slate-500">No documents in review queue.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-4">
            AI extraction results
            <span className="text-sm font-normal text-slate-500 ml-2">(raw output — never employer visible)</span>
          </h2>
          <div className="space-y-4">
            {aiResults?.length ? (
              aiResults.map((result) => {
                const label = confidenceLabel(result.confidence_score ?? 0);
                return (
                  <Card key={result.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Badge variant={label === 'high' ? 'success' : label === 'medium' ? 'warning' : 'danger'}>
                          {result.confidence_score ?? 0}%
                        </Badge>
                        {(result.candidate_documents as { document_type?: string })?.document_type}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AiExtractionEditor extraction={result} />
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <p className="text-slate-500">No AI results pending review.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
