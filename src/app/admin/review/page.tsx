import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DocumentReviewActions } from '@/components/admin/document-review-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/utils';

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
          <h2 className="text-lg font-semibold mb-4">AI extraction results (raw — not employer visible)</h2>
          <div className="space-y-3">
            {aiResults?.length ? (
              aiResults.map((result) => (
                <Card key={result.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      Confidence: {result.confidence_score ?? 'N/A'}% ·{' '}
                      {(result.candidate_documents as { document_type?: string })?.document_type}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-slate-100 p-3 rounded-lg overflow-auto max-h-40">
                      {JSON.stringify(result.extracted_fields ?? result.raw_ai_output, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-slate-500">No AI results pending review.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
