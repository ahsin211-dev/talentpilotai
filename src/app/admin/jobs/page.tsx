import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { RetryJobButton } from "@/components/admin-forms";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  await requireActor("admin");
  const supabase = createSupabaseServerClient();

  const { data: jobs } = await supabase
    .from("document_processing_jobs")
    .select("id, job_type, status, attempts, max_attempts, last_error, created_at")
    .in("status", ["failed", "dead_letter", "running", "queued"])
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <PageHeader title="Processing jobs" subtitle="Monitor and retry failed AI/OCR jobs." />
      {jobs && jobs.length > 0 ? (
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Type</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Attempts</th>
                <th className="pb-2">Last error</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-slate-100 align-top">
                  <td className="py-2">{j.job_type}</td>
                  <td className="py-2"><StatusBadge status={j.status} /></td>
                  <td className="py-2">{j.attempts}/{j.max_attempts}</td>
                  <td className="py-2 max-w-xs truncate text-red-600">{j.last_error ?? "—"}</td>
                  <td className="py-2 text-right">
                    {j.status === "failed" || j.status === "dead_letter" ? <RetryJobButton jobId={j.id} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No active or failed jobs." />
      )}
    </div>
  );
}
