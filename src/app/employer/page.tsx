import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmployerNav } from "@/components/employer/employer-nav";
import { CandidateGrid } from "@/components/employer/candidate-grid";
import { SubscriptionGate } from "@/components/employer/subscription-gate";

export default async function EmployerDashboard({
  searchParams,
}: {
  searchParams: { occupation?: string; country?: string; skills?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: employer } = await supabase
    .from("employer_accounts")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!employer) redirect("/employer/onboarding");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("employer_id", employer.id)
    .single();

  const hasActiveSub =
    subscription && ["active", "trialing"].includes(subscription.status);

  let query = supabase
    .from("candidate_profiles_public_redacted")
    .select("*, occupation_codes(code, title)")
    .eq("status", "approved");

  if (searchParams.occupation) {
    query = query.ilike("occupation_title", `%${searchParams.occupation}%`);
  }
  if (searchParams.country) {
    query = query.ilike("country_of_origin", `%${searchParams.country}%`);
  }

  const { data: profiles } = hasActiveSub ? await query.order("approved_at", { ascending: false }) : { data: [] };

  const { data: favourites } = hasActiveSub
    ? await supabase
        .from("employer_favourites")
        .select("candidate_id")
        .eq("employer_id", employer.id)
    : { data: [] };

  const favouriteIds = new Set(favourites?.map((f) => f.candidate_id) ?? []);

  return (
    <div className="min-h-screen bg-slate-50">
      <EmployerNav companyName={employer.company_name} />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {!hasActiveSub ? (
          <SubscriptionGate />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Browse Candidates</h1>
                <p className="text-sm text-slate-500">
                  Redacted profiles — contact details available after candidate approval
                </p>
              </div>
              <Link
                href="/employer/favourites"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Favourites ({favouriteIds.size})
              </Link>
            </div>

            <Card className="mb-6">
              <form className="flex flex-wrap gap-4">
                <input
                  name="occupation"
                  placeholder="Occupation"
                  defaultValue={searchParams.occupation}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  name="country"
                  placeholder="Country"
                  defaultValue={searchParams.country}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Search
                </button>
              </form>
            </Card>

            <CandidateGrid
              profiles={profiles ?? []}
              favouriteIds={favouriteIds}
              employerId={employer.id}
            />
          </>
        )}
      </main>
    </div>
  );
}
