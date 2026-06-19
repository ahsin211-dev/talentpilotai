import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const STAGE_STEPS = [
  "intake",
  "document_review",
  "ai_processing",
  "admin_review",
  "profile_published",
  "employer_matching",
  "contact_approved",
  "placed",
];

export default async function CandidateStatusPage() {
  const actor = await requireActor("candidate");
  const supabase = createSupabaseServerClient();

  const { data: candidate } = await supabase
    .from("candidates")
    .select("status, current_stage, consent_given")
    .eq("id", actor.candidateId!)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("candidate_profiles_public_redacted")
    .select("display_name, headline, is_published, redaction_status")
    .eq("candidate_id", actor.candidateId!)
    .maybeSingle();

  const { data: stages } = await supabase
    .from("case_stages")
    .select("stage, notes, created_at")
    .eq("candidate_id", actor.candidateId!)
    .order("created_at", { ascending: false })
    .limit(10);

  const currentIdx = STAGE_STEPS.indexOf(candidate?.current_stage ?? "intake");

  return (
    <div>
      <PageHeader
        title="Application status"
        subtitle="Track your progress from intake to placement."
        action={candidate ? <StatusBadge status={candidate.status} /> : undefined}
      />

      <div className="card mb-6">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Progress</h2>
        <ol className="space-y-2">
          {STAGE_STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  i <= currentIdx ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {i + 1}
              </span>
              <span className={i <= currentIdx ? "font-medium text-slate-900" : "text-slate-500"}>
                {step.replace(/_/gu, " ")}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {profile ? (
        <div className="card mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Your redacted public profile</h2>
          <p className="text-slate-900">{profile.display_name} — {profile.headline}</p>
          <p className="mt-1 text-sm text-slate-500">
            Visibility: {profile.is_published ? "published to employers" : "not yet published"} ·
            redaction {profile.redaction_status}
          </p>
        </div>
      ) : (
        <div className="card mb-6 text-sm text-slate-600">
          No public profile yet. Complete{" "}
          <Link href="/candidate/intake" className="text-brand-700 hover:underline">your details</Link>{" "}
          and{" "}
          <Link href="/candidate/documents" className="text-brand-700 hover:underline">upload your CV</Link>.
        </div>
      )}

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Recent activity</h2>
        {stages && stages.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {stages.map((s, i) => (
              <li key={i} className="flex justify-between border-b border-slate-100 pb-2">
                <span className="font-medium">{s.stage.replace(/_/gu, " ")}</span>
                <span className="text-slate-400">{new Date(s.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No activity yet.</p>
        )}
      </div>
    </div>
  );
}
