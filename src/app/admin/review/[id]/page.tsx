import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { ReviewForm } from "@/components/admin-forms";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function ReviewExtractionPage({ params }: { params: { id: string } }) {
  await requireActor("admin");
  const supabase = createSupabaseServerClient();

  const { data: result } = await supabase
    .from("ai_extraction_results")
    .select("id, candidate_id, model, confidence_score, raw_output, redacted_output, suggested_occupation_code_id, created_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!result) notFound();

  await logAudit({
    action: "admin_viewed_extraction",
    resourceType: "ai_extraction_results",
    resourceId: result.id,
    candidateId: result.candidate_id,
  });

  const { data: occupations } = await supabase
    .from("occupation_codes")
    .select("id, code, title")
    .eq("is_active", true)
    .order("code");

  const redacted = (result.redacted_output ?? {}) as Record<string, unknown>;
  const raw = (result.raw_output ?? {}) as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin" className="text-sm text-slate-500 hover:text-brand-700">← Back to queue</Link>
      <PageHeader
        title="Review extraction"
        subtitle={`Model ${result.model ?? "n/a"} · confidence ${Math.round((result.confidence_score ?? 0) * 100)}%`}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-red-700">RAW AI output (admin-only — never shown to employers)</h2>
          <pre className="overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Proposed redacted output</h2>
          <pre className="overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-700">
            {JSON.stringify(redacted, null, 2)}
          </pre>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Approve, edit or reject</h2>
        <ReviewForm
          aiResultId={result.id}
          occupations={occupations ?? []}
          suggested={{
            displayName: str(redacted.displayName),
            headline: str(redacted.headline),
            summary: str(redacted.summary),
            occupationTitle: str(redacted.occupationTitle) ?? str(raw.occupationTitle),
            skills: Array.isArray(redacted.skills) ? (redacted.skills as string[]) : [],
            yearsExperience: typeof redacted.yearsExperience === "number" ? redacted.yearsExperience : undefined,
            countryOfOrigin: str(redacted.countryOfOrigin),
          }}
        />
      </div>
    </div>
  );
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
