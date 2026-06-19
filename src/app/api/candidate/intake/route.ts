import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { candidateIntakeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireRole("candidate");
    const payload = candidateIntakeSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .upsert(
        {
          user_id: actor.userId,
          given_name: payload.givenName,
          country_of_residence: payload.countryOfResidence,
          primary_trade: payload.primaryTrade,
          years_experience: payload.yearsExperience ?? null,
          availability_date: payload.availabilityDate ?? null,
          consent_collected_at: new Date().toISOString(),
          current_case_stage: "documents_pending"
        },
        { onConflict: "user_id" }
      )
      .select("id,current_case_stage")
      .single();

    if (candidateError) {
      throw new Error(candidateError.message);
    }

    const { error: privateError } = await supabase.from("candidate_private_details").upsert(
      {
        candidate_id: candidate.id,
        surname: payload.surname,
        email: payload.email,
        phone: payload.phone ?? null,
        whatsapp: payload.whatsapp ?? null
      },
      { onConflict: "candidate_id" }
    );

    if (privateError) {
      throw new Error(privateError.message);
    }

    await writeAuditLog({
      action: "candidate_intake_submitted",
      targetTable: "candidates",
      targetId: candidate.id,
      metadata: { stage: candidate.current_case_stage }
    });

    return jsonOk({ candidateId: candidate.id, stage: candidate.current_case_stage }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
