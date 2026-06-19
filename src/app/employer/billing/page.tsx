import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui";
import { BillingButton } from "@/components/employer-forms";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const actor = await requireActor("employer");
  const supabase = createSupabaseServerClient();

  const { data: emp } = await supabase
    .from("employer_accounts")
    .select("company_name, subscription_status")
    .eq("id", actor.employerId!)
    .maybeSingle();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end")
    .eq("employer_id", actor.employerId!)
    .order("created_at", { ascending: false })
    .maybeSingle();

  const active = emp?.subscription_status === "active" || emp?.subscription_status === "trialing";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Subscription" subtitle="Your subscription unlocks browsing, favourites and contact requests." />
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Current status</span>
          <StatusBadge status={emp?.subscription_status ?? "incomplete"} />
        </div>
        {sub?.current_period_end ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Renews</span>
            <span>{new Date(sub.current_period_end).toLocaleDateString()}</span>
          </div>
        ) : null}

        {active ? (
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Your subscription is active. All employer features are unlocked.
          </p>
        ) : (
          <div>
            <p className="mb-3 text-sm text-slate-600">
              Subscribe to access AI-redacted candidate profiles and request contact.
            </p>
            <BillingButton />
          </div>
        )}
      </div>
    </div>
  );
}
