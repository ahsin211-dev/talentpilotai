import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireActor("admin");
  const supabase = createSupabaseServerClient();

  // RLS restricts audit log reads to senior_reviewer+ — plain reviewers see none.
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, actor_role, resource_type, resource_id, candidate_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div>
      <PageHeader title="Audit logs" subtitle="Every sensitive access and privileged action is recorded here (append-only)." />
      {logs && logs.length > 0 ? (
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Time</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Actor</th>
                <th className="pb-2">Resource</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-2 text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="py-2 font-medium">{l.action}</td>
                  <td className="py-2">{l.actor_role}</td>
                  <td className="py-2 text-slate-500">{l.resource_type ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No audit entries visible to your role." />
      )}
    </div>
  );
}
