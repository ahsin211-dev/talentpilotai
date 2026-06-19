import { requireRole } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { jsonError, jsonOk } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unlockRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireRole("employer");
    const payload = unlockRequestSchema.parse(await request.json());
    const supabase = await createSupabaseServerClient();

    const { data: employer, error: employerError } = await supabase
      .from("employer_accounts")
      .select("id")
      .eq("user_id", actor.userId)
      .single();

    if (employerError || !employer) {
      throw new Error("Employer account not found");
    }

    const { data: unlockRequest, error } = await supabase
      .from("contact_unlock_requests")
      .insert({
        employer_id: employer.id,
        candidate_id: payload.candidateId,
        message_to_candidate: payload.messageToCandidate ?? null,
        status: "requested"
      })
      .select("id,status")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await writeAuditLog({
      action: "employer_contact_unlock_requested",
      targetTable: "contact_unlock_requests",
      targetId: unlockRequest.id,
      metadata: {
        candidateId: payload.candidateId,
        employerId: employer.id
      }
    });

    return jsonOk(unlockRequest, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
