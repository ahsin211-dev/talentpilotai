import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmployerNav } from "@/components/employer/employer-nav";
import { Card } from "@/components/ui/card";
import { CandidateGrid } from "@/components/employer/candidate-grid";

export default async function EmployerFavouritesPage() {
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

  const { data: favourites } = await supabase
    .from("employer_favourites")
    .select("candidate_id")
    .eq("employer_id", employer.id);

  const candidateIds = favourites?.map((f) => f.candidate_id) ?? [];

  const { data: profiles } = candidateIds.length
    ? await supabase
        .from("candidate_profiles_public_redacted")
        .select("*, occupation_codes(code, title)")
        .in("candidate_id", candidateIds)
        .eq("status", "approved")
    : { data: [] };

  const favouriteIds = new Set(candidateIds);

  return (
    <div className="min-h-screen bg-slate-50">
      <EmployerNav companyName={employer.company_name} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Saved Candidates</h1>
        <div className="mt-6">
          {profiles?.length ? (
            <CandidateGrid
              profiles={profiles}
              favouriteIds={favouriteIds}
              employerId={employer.id}
            />
          ) : (
            <Card>
              <p className="text-center text-slate-500">No favourites yet</p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
