import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, EmptyState } from "@/components/ui";
import { FavouriteButton } from "@/components/employer-forms";

export const dynamic = "force-dynamic";

export default async function FavouritesPage() {
  const actor = await requireActor("employer");
  const supabase = createSupabaseServerClient();

  const { data: favs } = await supabase
    .from("employer_favourites")
    .select("candidate_profile_id, candidate_profiles_public_redacted(id, display_name, headline, occupation_title, candidate_id)")
    .eq("employer_id", actor.employerId!);

  const rows = (favs ?? [])
    .map((f) => f.candidate_profiles_public_redacted as unknown as {
      id: string; display_name: string; headline: string; occupation_title: string;
    } | null)
    .filter(Boolean) as Array<{ id: string; display_name: string; headline: string; occupation_title: string }>;

  return (
    <div>
      <PageHeader title="Saved candidates" subtitle="Your shortlisted profiles." />
      {rows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{c.display_name}</p>
                  <p className="text-sm text-slate-500">{c.occupation_title}</p>
                </div>
                <FavouriteButton profileId={c.id} isFavourite />
              </div>
              <p className="mt-2 text-sm text-slate-600">{c.headline}</p>
              <Link href={`/employer/candidate/${c.id}`} className="btn-secondary mt-4 text-center">View profile</Link>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No saved candidates yet." />
      )}
    </div>
  );
}
