import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, StatusBadge } from "@/components/ui/card";
import { AdminNav } from "@/components/admin/admin-nav";
import { ReviewActions } from "@/components/admin/review-actions";

export default async function AdminDashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: pendingDocs } = await supabase
    .from("candidate_documents")
    .select("*, candidates(id, user_id)")
    .in("status", ["review_required", "processing"])
    .order("uploaded_at", { ascending: true })
    .limit(20);

  const { data: pendingProfiles } = await supabase
    .from("candidate_profiles_public_redacted")
    .select("*")
    .in("status", ["pending_review", "draft"])
    .order("updated_at", { ascending: true })
    .limit(20);

  const { data: pendingUnlocks } = await supabase
    .from("contact_unlock_requests")
    .select("*, employer_accounts(company_name)")
    .eq("status", "pending")
    .limit(20);

  const { data: recentAudits } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-sm text-slate-500">Review queue and compliance oversight</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Documents pending review ({pendingDocs?.length ?? 0})
            </h2>
            <div className="space-y-3">
              {pendingDocs?.map((doc) => (
                <Card key={doc.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">{doc.document_type}</p>
                      <p className="text-xs text-slate-500">{doc.file_name}</p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </div>
                  <ReviewActions type="document" resourceId={doc.id} />
                </Card>
              ))}
              {!pendingDocs?.length && (
                <p className="text-sm text-slate-500">No documents pending review</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Profiles pending approval ({pendingProfiles?.length ?? 0})
            </h2>
            <div className="space-y-3">
              {pendingProfiles?.map((profile) => (
                <Card key={profile.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{profile.display_first_name}</p>
                      <p className="text-xs text-slate-500">
                        {profile.occupation_title ?? "No occupation mapped"}
                      </p>
                    </div>
                    <StatusBadge status={profile.status} />
                  </div>
                  <ReviewActions type="profile" resourceId={profile.id} />
                </Card>
              ))}
              {!pendingProfiles?.length && (
                <p className="text-sm text-slate-500">No profiles pending approval</p>
              )}
            </div>
          </section>
        </div>

        {pendingUnlocks && pendingUnlocks.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              Unlock requests ({pendingUnlocks.length})
            </h2>
            <div className="space-y-2">
              {pendingUnlocks.map((req) => (
                <Card key={req.id}>
                  <p className="text-sm">
                    {(req.employer_accounts as { company_name?: string })?.company_name ?? "Employer"}{" "}
                    requested contact access
                  </p>
                  <StatusBadge status={req.status} />
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Recent audit log</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Action</th>
                    <th className="pb-2 pr-4">Resource</th>
                    <th className="pb-2">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAudits?.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleString("en-AU")}
                      </td>
                      <td className="py-2 pr-4">{log.action}</td>
                      <td className="py-2 pr-4">
                        {log.resource_type}
                        {log.resource_id && (
                          <span className="ml-1 text-xs text-slate-400">
                            {log.resource_id.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td className="py-2">{log.actor_role ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <div className="mt-4 flex gap-4">
          <Link href="/admin/occupations" className="text-sm text-blue-600 hover:underline">
            Manage occupation codes
          </Link>
          <Link href="/admin/jobs" className="text-sm text-blue-600 hover:underline">
            Failed jobs
          </Link>
        </div>
      </main>
    </div>
  );
}
