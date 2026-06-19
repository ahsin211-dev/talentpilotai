import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui";
import { SearchForm, FavouriteButton } from "@/components/employer-forms";
import { candidateSearchSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export default async function EmployerBrowsePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await requireActor("employer");
  const supabase = createSupabaseServerClient();

  // Subscription state controls whether browsing returns anything (DB-enforced).
  const { data: emp } = await supabase
    .from("employer_accounts")
    .select("subscription_status")
    .eq("id", actor.employerId!)
    .maybeSingle();
  const subscribed = emp?.subscription_status === "active" || emp?.subscription_status === "trialing";

  const params = candidateSearchSchema.safeParse({
    q: searchParams.q,
    country: searchParams.country,
    minExperience: searchParams.minExperience,
  });
  const f = params.success ? params.data : { page: 1, pageSize: 20 };

  let query = supabase
    .from("employer_candidate_cards")
    .select("profile_id, candidate_id, display_name, headline, occupation_title, occupation_code, skills, years_experience, country_of_origin, availability, visa_stage")
    .order("created_at", { ascending: false })
    .limit(f.pageSize ?? 20);

  if ("q" in f && f.q) query = query.or(`headline.ilike.%${f.q}%,occupation_title.ilike.%${f.q}%,summary.ilike.%${f.q}%`);
  if ("country" in f && f.country) query = query.ilike("country_of_origin", `%${f.country}%`);
  if ("minExperience" in f && f.minExperience) query = query.gte("years_experience", f.minExperience);

  const { data: cards } = await query;

  const { data: favs } = await supabase
    .from("employer_favourites")
    .select("candidate_profile_id")
    .eq("employer_id", actor.employerId!);
  const favSet = new Set((favs ?? []).map((x) => x.candidate_profile_id));

  return (
    <div>
      <PageHeader
        title="Browse candidates"
        subtitle="All profiles are AI-redacted and admin-approved. Contact details require candidate consent."
      />

      {!subscribed ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          An active subscription is required to view and contact candidates.{" "}
          <Link href="/employer/billing" className="font-medium underline">Subscribe now</Link>.
        </div>
      ) : null}

      <div className="card mb-6">
        <SearchForm
          defaults={{
            q: typeof searchParams.q === "string" ? searchParams.q : "",
            country: typeof searchParams.country === "string" ? searchParams.country : "",
            minExperience: typeof searchParams.minExperience === "string" ? searchParams.minExperience : "",
          }}
        />
      </div>

      {cards && cards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <div key={c.profile_id} className="card flex flex-col">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{c.display_name}</p>
                  <p className="text-sm text-slate-500">{c.occupation_title}{c.occupation_code ? ` · ${c.occupation_code}` : ""}</p>
                </div>
                <FavouriteButton profileId={c.profile_id} isFavourite={favSet.has(c.profile_id)} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{c.headline}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {(c.skills ?? []).slice(0, 6).map((s: string) => (
                  <span key={s} className="badge bg-brand-50 text-brand-700">{s}</span>
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-1 text-xs text-slate-500">
                <div>Experience: {c.years_experience ?? "—"} yrs</div>
                <div>Country: {c.country_of_origin ?? "—"}</div>
                <div>Availability: {c.availability ?? "—"}</div>
                <div>Visa: {c.visa_stage ?? "—"}</div>
              </dl>
              <Link href={`/employer/candidate/${c.profile_id}`} className="btn-secondary mt-4 text-center">
                View profile
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message={subscribed ? "No candidates match your search yet." : "Subscribe to view candidate profiles."} />
      )}
    </div>
  );
}
