import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { UnlockResponse } from "@/components/candidate-forms";

export const dynamic = "force-dynamic";

export default async function ContactRequestsPage() {
  const actor = await requireActor("candidate");
  const supabase = createSupabaseServerClient();

  const { data: requests } = await supabase
    .from("contact_unlock_requests")
    .select("id, status, message, requested_at, employer_id, employer_accounts(company_name)")
    .eq("candidate_id", actor.candidateId!)
    .order("requested_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Contact requests"
        subtitle="Employers can request to contact you. Your details are shared only if you approve."
      />
      {requests && requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((r) => {
            const company =
              (r.employer_accounts as unknown as { company_name?: string } | null)?.company_name ??
              "An employer";
            return (
              <div key={r.id} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{company}</p>
                    <p className="text-sm text-slate-500">
                      Requested {new Date(r.requested_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.message ? <p className="mt-2 text-sm text-slate-600">“{r.message}”</p> : null}
                {r.status === "pending" ? (
                  <div className="mt-4">
                    <UnlockResponse requestId={r.id} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState message="No contact requests yet." />
      )}
    </div>
  );
}
