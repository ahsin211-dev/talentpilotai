import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { favouriteRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireRole("employer");
    const payload = favouriteRequestSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data: employer, error: employerError } = await supabase
      .from("employer_accounts")
      .select("id")
      .eq("user_id", actor.userId)
      .single();

    if (employerError || !employer) {
      throw new Error("Employer account not found");
    }

    const { error } = await supabase.from("employer_favourites").upsert(
      {
        employer_id: employer.id,
        candidate_id: payload.candidateId
      },
      { onConflict: "employer_id,candidate_id" }
    );

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      action: "employer_candidate_favourited",
      targetTable: "candidate_profiles_public_redacted",
      targetId: payload.candidateId,
      metadata: { employerId: employer.id }
    });

    return jsonOk({ candidateId: payload.candidateId, favourited: true }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
