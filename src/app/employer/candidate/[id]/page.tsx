import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui";
import { UnlockRequestForm, RevealContactButton } from "@/components/employer-forms";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function CandidateProfilePage({ params }: { params: { id: string } }) {
  const actor = await requireActor("employer");
  const supabase = createSupabaseServerClient();

  // RLS ensures only published+approved profiles are returned to employers.
  const { data: card } = await supabase
    .from("employer_candidate_cards")
    .select("*")
    .eq("profile_id", params.id)
    .maybeSingle();

  if (!card) notFound();

  await logAudit({
    action: "employer_viewed_profile",
    resourceType: "candidate_profiles_public_redacted",
    resourceId: params.id,
    candidateId: card.candidate_id,
    employerId: actor.employerId!,
  });

  // Existing request + approval state for this candidate.
  const { data: req } = await supabase
    .from("contact_unlock_requests")
    .select("status")
    .eq("employer_id", actor.employerId!)
    .eq("candidate_id", card.candidate_id)
    .maybeSingle();

  const { data: approval } = await supabase
    .from("candidate_contact_approvals")
    .select("approved, revoked_at")
    .eq("employer_id", actor.employerId!)
    .eq("candidate_id", card.candidate_id)
    .maybeSingle();
  const unlocked = approval?.approved && !approval?.revoked_at;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/employer" className="text-sm text-slate-500 hover:text-brand-700">← Back to browse</Link>
      <PageHeader
        title={card.display_name}
        subtitle={`${card.occupation_title ?? "Skilled tradesperson"}${card.occupation_code ? ` · ${card.occupation_code}` : ""}`}
      />

      <div className="card mb-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Professional summary</h2>
        <p className="text-sm text-slate-700">{card.summary}</p>
        <div className="mt-4 flex flex-wrap gap-1">
          {(card.skills ?? []).map((s: string) => (
            <span key={s} className="badge bg-brand-50 text-brand-700">{s}</span>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
          <div>Experience: {card.years_experience ?? "—"} yrs</div>
          <div>Country of origin: {card.country_of_origin ?? "—"}</div>
          <div>Availability: {card.availability ?? "—"}</div>
          <div>Visa stage: {card.visa_stage ?? "—"}</div>
          <div>Qualification: {card.highest_qualification ?? "—"}</div>
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          Surname, contact details and identity documents are withheld for privacy and become available only with the candidate's explicit consent.
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Contact this candidate</h2>
        {unlocked ? (
          <RevealContactButton candidateId={card.candidate_id} />
        ) : req?.status === "pending" ? (
          <p className="text-sm text-amber-700">Request pending — awaiting candidate approval. <StatusBadge status="pending" /></p>
        ) : req?.status === "rejected" ? (
          <p className="text-sm text-red-600">The candidate declined this contact request.</p>
        ) : (
          <UnlockRequestForm candidateId={card.candidate_id} profileId={card.profile_id} />
        )}
      </div>
    </div>
  );
}
