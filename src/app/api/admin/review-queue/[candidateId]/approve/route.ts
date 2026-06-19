import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { badRequestFromZod, parseJsonBody } from "@/lib/validation/http";

const reviewDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  rewrittenSummary: z.string().max(4000).optional(),
  keySkills: z.array(z.string().min(1).max(80)).max(80).optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  rejectionReason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ candidateId: string }> },
) {
  try {
    const { userId } = await requireAuthenticatedUser(["admin"]);
    const { candidateId } = await context.params;
    const payload = await parseJsonBody(req, reviewDecisionSchema);
    const supabase = await createSupabaseServerClient();

    const now = new Date().toISOString();
    const approved = payload.decision === "approved";
    const updatePayload = {
      profile_status: payload.decision,
      rewritten_summary: payload.rewrittenSummary ?? null,
      key_skills: payload.keySkills ?? [],
      confidence_score: payload.confidenceScore ?? null,
      admin_reviewed_by: userId,
      admin_reviewed_at: now,
      published_at: approved ? now : null,
      is_visible: approved,
    };

    const { data: profile, error: profileError } = await supabase
      .from("candidate_profiles_public_redacted")
      .update(updatePayload)
      .eq("candidate_id", candidateId)
      .select("id,candidate_id")
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: profileError?.message ?? "Unable to update redacted profile." },
        { status: 500 },
      );
    }

    await supabase.from("case_stages").upsert(
      {
        candidate_id: candidateId,
        stage: "document_review",
        stage_status: approved ? "completed" : "blocked",
        notes: approved
          ? "Redacted profile approved and published for employer marketplace."
          : payload.rejectionReason ?? "Profile rejected during compliance review.",
        set_by_user_id: userId,
      },
      { onConflict: "candidate_id,stage" },
    );

    await recordAuditEvent({
      action: "admin_profile_review_decision",
      resourceType: "candidate_profiles_public_redacted",
      resourceId: profile.id,
      metadata: {
        candidateId,
        decision: payload.decision,
      },
      accessLevel: "sensitive",
    });

    return NextResponse.json({ status: payload.decision });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequestFromZod(error);
    }

    return NextResponse.json(
      { error: "Unable to process admin review decision." },
      { status: 500 },
    );
  }
}
