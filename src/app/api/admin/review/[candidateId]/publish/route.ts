import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminPublishProfileSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    candidateId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireRole("admin");
    const { candidateId } = await context.params;
    const payload = adminPublishProfileSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", actor.userId)
      .single();

    if (adminError || !adminUser) {
      throw new Error("Admin account is not registered");
    }

    const { error: profileError } = await supabase.from("candidate_profiles_public_redacted").upsert(
      {
        candidate_id: candidateId,
        display_name: payload.displayName,
        country_of_residence: payload.countryOfResidence,
        primary_trade: payload.primaryTrade,
        occupation_code_id: payload.occupationCodeId ?? null,
        skills: payload.skills,
        qualifications: payload.qualifications,
        years_experience: payload.yearsExperience ?? null,
        availability_date: payload.availabilityDate ?? null,
        visa_stage: payload.visaStage,
        professional_summary: payload.professionalSummary,
        approved_by: adminUser.id,
        approved_at: new Date().toISOString(),
        is_employer_visible: true
      },
      { onConflict: "candidate_id" }
    );

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: candidateError } = await supabase
      .from("candidates")
      .update({ current_case_stage: "employer_visible" })
      .eq("id", candidateId);

    if (candidateError) {
      throw new Error(candidateError.message);
    }

    await writeAuditLog({
      action: "admin_redacted_profile_published",
      targetTable: "candidate_profiles_public_redacted",
      targetId: candidateId,
      metadata: {
        adminUserId: adminUser.id,
        occupationCodeId: payload.occupationCodeId ?? null
      }
    });

    return jsonOk({ candidateId, visibleToEmployers: true });
  } catch (error) {
    return jsonError(error);
  }
}
