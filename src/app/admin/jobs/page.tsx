import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, StatusBadge } from "@/components/ui/card";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminJobsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: failedJobs } = await supabase
    .from("document_processing_jobs")
    .select("*, candidate_documents(file_name, document_type)")
    .in("status", ["failed", "retrying"])
    .order("updated_at", { ascending: false });

  const { data: failedWebhooks } = await supabase
    .from("webhooks")
    .select("*")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Failed Jobs & Integrations</h1>

        <section className="mt-6">
          <h2 className="mb-3 font-semibold">Document processing</h2>
          <div className="space-y-2">
            {failedJobs?.map((job) => (
              <Card key={job.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {(job.candidate_documents as { file_name?: string })?.file_name ?? "Document"}
                    </p>
                    <p className="text-xs text-red-600">{job.error_message}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              </Card>
            ))}
            {!failedJobs?.length && (
              <p className="text-sm text-slate-500">No failed processing jobs</p>
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Webhook failures</h2>
          <div className="space-y-2">
            {failedWebhooks?.map((wh) => (
              <Card key={wh.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {wh.provider} — {wh.event_type}
                    </p>
                    <p className="text-xs text-red-600">{wh.error_message}</p>
                  </div>
                  <StatusBadge status={wh.status} />
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
