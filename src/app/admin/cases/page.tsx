import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { CaseStageForm } from "@/components/admin-forms";

export const dynamic = "force-dynamic";

export default async function AdminCasesPage() {
  await requireActor("admin");
  const supabase = createSupabaseServerClient();

  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, status, current_stage, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <PageHeader title="Case management" subtitle="Progress candidates through the recruitment and visa pipeline." />
      {candidates && candidates.length > 0 ? (
        <div className="space-y-4">
          {candidates.map((c) => (
            <div key={c.id} className="card">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-mono text-xs text-slate-500">{c.id}</p>
                  <p className="mt-1 text-sm">Stage: <span className="font-medium">{c.current_stage.replace(/_/gu, " ")}</span></p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <CaseStageForm candidateId={c.id} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No candidates yet." />
      )}
    </div>
  );
}
