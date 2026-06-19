import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/access";
import { adminPublishProfileSchema } from "@/lib/domain";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/security/audit";

export async function POST(request: Request) {
  try {
    const payload = adminPublishProfileSchema.parse(await request.json());
    const context = await requireRole(["admin"]);
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("candidate_profiles_public_redacted")
      .update({
        occupation_code: payload.occupationCode,
        headline: payload.headline,
        summary_redacted: payload.summaryRedacted,
        skills: payload.skills,
        approval_status: "approved",
        approved_by_user_id: context.userId,
        approved_at: new Date().toISOString()
      })
      .eq("candidate_id", payload.candidateId);

    if (error) {
      throw error;
    }

    await supabase.from("ai_extraction_results").insert({
      candidate_id: payload.candidateId,
      approved_output: {
        headline: payload.headline,
        summaryRedacted: payload.summaryRedacted,
        skills: payload.skills,
        occupationCode: payload.occupationCode
      },
      confidence_score: payload.confidenceScore,
      reviewed_by_user_id: context.userId,
      reviewed_at: new Date().toISOString()
    });

    await logAuditEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      action: "admin.profile.published",
      targetTable: "candidate_profiles_public_redacted",
      targetId: payload.candidateId,
      metadata: {
        confidenceScore: payload.confidenceScore,
        occupationCode: payload.occupationCode
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 400 }
    );
  }
}
