import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { UploadForm } from "@/components/candidate-forms";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const actor = await requireActor("candidate");
  const supabase = createSupabaseServerClient();
  const { data: docs } = await supabase
    .from("candidate_documents")
    .select("id, document_type, file_name, upload_status, scan_status, created_at")
    .eq("candidate_id", actor.candidateId!)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title="Documents" subtitle="Upload your CV, ID and qualifications. Files are encrypted at rest." />
      <div className="card mb-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Upload a document</h2>
        <UploadForm />
      </div>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Your documents</h2>
        {docs && docs.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Type</th>
                <th className="pb-2">File</th>
                <th className="pb-2">Upload</th>
                <th className="pb-2">Scan</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="py-2 capitalize">{d.document_type.replace(/_/gu, " ")}</td>
                  <td className="py-2">{d.file_name}</td>
                  <td className="py-2"><StatusBadge status={d.upload_status} /></td>
                  <td className="py-2"><StatusBadge status={d.scan_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No documents uploaded yet." />
        )}
      </div>
    </div>
  );
}
