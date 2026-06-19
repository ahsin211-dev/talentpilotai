import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EmployerRequestsPage() {
  const actor = await requireActor("employer");
  const supabase = createSupabaseServerClient();

  const { data: requests } = await supabase
    .from("contact_unlock_requests")
    .select("id, candidate_id, candidate_profile_id, status, requested_at")
    .eq("employer_id", actor.employerId!)
    .order("requested_at", { ascending: false });

  return (
    <div>
      <PageHeader title="Contact requests" subtitle="Track the status of your unlock requests." />
      {requests && requests.length > 0 ? (
        <div className="card">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Candidate</th>
                <th className="pb-2">Requested</th>
                <th className="pb-2">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs">{r.candidate_id.slice(0, 8)}…</td>
                  <td className="py-2">{new Date(r.requested_at).toLocaleDateString()}</td>
                  <td className="py-2"><StatusBadge status={r.status} /></td>
                  <td className="py-2 text-right">
                    {r.candidate_profile_id ? (
                      <Link href={`/employer/candidate/${r.candidate_profile_id}`} className="text-brand-700 hover:underline">
                        View
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState message="No contact requests yet." />
      )}
    </div>
  );
}
