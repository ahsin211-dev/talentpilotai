"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireActor } from "@/lib/auth/session";
import { adminReviewSchema, caseStageSchema } from "@/lib/validation/schemas";
import { buildDisplayName, redactText, assertNoPii } from "@/lib/ai/redact";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok?: true; error?: string } | null;

/**
 * Review an AI extraction result. On approval, the admin-approved, redacted
 * output is published to the employer-facing profile. RAW AI output is NEVER
 * copied to the public profile — only the curated, redacted fields are.
 */
export async function reviewExtraction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor("admin");
  const decision = String(formData.get("decision") ?? "");

  const parsed = adminReviewSchema.safeParse({
    aiResultId: formData.get("aiResultId"),
    decision,
    reviewerNotes: formData.get("reviewerNotes") || undefined,
    approvedOutput: {
      displayName: formData.get("displayName") || undefined,
      headline: formData.get("headline") || undefined,
      summary: formData.get("summary") || undefined,
      occupationTitle: formData.get("occupationTitle") || undefined,
      occupationCodeId: formData.get("occupationCodeId") || undefined,
      skills: formData.get("skills")
        ? String(formData.get("skills")).split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
      yearsExperience: formData.get("yearsExperience") ? Number(formData.get("yearsExperience")) : undefined,
      countryOfOrigin: formData.get("countryOfOrigin") || undefined,
      availability: formData.get("availability") || undefined,
      visaStage: formData.get("visaStage") || undefined,
      highestQualification: formData.get("highestQualification") || undefined,
    },
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = createSupabaseServerClient();
  const { data: result, error: fetchErr } = await supabase
    .from("ai_extraction_results")
    .select("id, candidate_id, raw_output")
    .eq("id", parsed.data.aiResultId)
    .maybeSingle();
  if (fetchErr || !result) return { error: "Extraction result not found" };

  if (parsed.data.decision === "reject") {
    await supabase
      .from("ai_extraction_results")
      .update({ review_status: "rejected", reviewer_notes: parsed.data.reviewerNotes ?? null, reviewed_by: actor.adminId!, reviewed_at: new Date().toISOString() })
      .eq("id", result.id);
    await supabase.from("candidates").update({ status: "in_review", current_stage: "admin_review" }).eq("id", result.candidate_id);
    await logAudit({ action: "ai_extraction_rejected", resourceType: "ai_extraction_results", resourceId: result.id, candidateId: result.candidate_id });
    revalidatePath("/admin");
    return { ok: true };
  }

  // Approve / edit -> publish redacted profile.
  const out = parsed.data.approvedOutput ?? {};
  const raw = (result.raw_output ?? {}) as Record<string, string | undefined>;
  const displayName = out.displayName ?? buildDisplayName(raw.firstName, raw.lastName);
  const summary = redactText({
    text: out.summary ?? raw.summary ?? "",
    firstName: raw.firstName,
    lastName: raw.lastName,
  });

  const profilePayload = {
    candidate_id: result.candidate_id,
    display_name: displayName,
    headline: out.headline ?? null,
    summary,
    occupation_code_id: out.occupationCodeId ?? null,
    occupation_title: out.occupationTitle ?? raw.occupationTitle ?? null,
    skills: out.skills ?? [],
    years_experience: out.yearsExperience ?? null,
    country_of_origin: out.countryOfOrigin ?? raw.country ?? null,
    availability: out.availability ?? null,
    visa_stage: out.visaStage ?? null,
    highest_qualification: out.highestQualification ?? raw.highestQualification ?? null,
    redaction_status: "approved" as const,
    is_published: true,
    approved_by: actor.adminId!,
    approved_at: new Date().toISOString(),
  };

  // Defence in depth: refuse to publish if obvious PII slipped through.
  assertNoPii(profilePayload as unknown as Record<string, unknown>);

  const { error: upsertErr } = await supabase
    .from("candidate_profiles_public_redacted")
    .upsert(profilePayload, { onConflict: "candidate_id" });
  if (upsertErr) return { error: upsertErr.message };

  await supabase
    .from("ai_extraction_results")
    .update({
      review_status: parsed.data.decision === "edit" ? "edited" : "approved",
      admin_approved_output: profilePayload,
      reviewer_notes: parsed.data.reviewerNotes ?? null,
      reviewed_by: actor.adminId!,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", result.id);

  await supabase
    .from("candidates")
    .update({ status: "profile_published", current_stage: "profile_published" })
    .eq("id", result.candidate_id);
  await supabase.from("case_stages").insert({
    candidate_id: result.candidate_id,
    stage: "profile_published",
    changed_by: actor.adminId!,
    notes: "Profile approved and published to employers",
  });

  await logAudit({
    action: "ai_extraction_approved_published",
    resourceType: "candidate_profiles_public_redacted",
    candidateId: result.candidate_id,
    metadata: { decision: parsed.data.decision },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function setCaseStage(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await requireActor("admin");
  const parsed = caseStageSchema.safeParse({
    candidateId: formData.get("candidateId"),
    stage: formData.get("stage"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Invalid stage" };

  const supabase = createSupabaseServerClient();
  await supabase.from("case_stages").insert({
    candidate_id: parsed.data.candidateId,
    stage: parsed.data.stage,
    notes: parsed.data.notes ?? null,
    changed_by: actor.adminId!,
  });
  await supabase.from("candidates").update({ current_stage: parsed.data.stage }).eq("id", parsed.data.candidateId);
  await logAudit({ action: "case_stage_changed", resourceType: "case_stages", candidateId: parsed.data.candidateId, metadata: { stage: parsed.data.stage } });
  revalidatePath("/admin/cases");
  return { ok: true };
}

/** Requeue a failed / dead-letter job (reviewer+ have RLS access to jobs). */
export async function retryJob(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireActor("admin");
  const jobId = String(formData.get("jobId") ?? "");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("document_processing_jobs")
    .update({ status: "queued", scheduled_at: new Date().toISOString(), last_error: null })
    .eq("id", jobId);
  if (error) return { error: error.message };
  await logAudit({ action: "job_requeued", resourceType: "document_processing_jobs", resourceId: jobId });
  revalidatePath("/admin/jobs");
  return { ok: true };
}
