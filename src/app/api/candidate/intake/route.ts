import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { candidateIntakeSchema } from "@/lib/validation/schemas";
import { badRequestFromZod, parseJsonBody } from "@/lib/validation/http";

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser(["candidate"]);
    const payload = await parseJsonBody(req, candidateIntakeSchema);
    const supabase = await createSupabaseServerClient();

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .upsert(
        {
          user_id: userId,
          given_name: payload.givenName,
          preferred_name: payload.preferredName ?? null,
          country_of_origin: payload.countryOfOrigin,
          current_occupation: payload.currentOccupation ?? null,
          years_experience: payload.yearsExperience ?? null,
          consent_data_processing: payload.consentDataProcessing,
          consent_marketing: payload.consentMarketing,
          consent_terms_accepted_at: new Date().toISOString(),
          profile_status: "pending_review",
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: candidateError?.message ?? "Failed to save candidate intake" },
        { status: 500 },
      );
    }

    const { error: privateError } = await supabase
      .from("candidate_private_details")
      .upsert(
        {
          candidate_id: candidate.id,
          surname: payload.surname,
          email: payload.email,
          phone: payload.phone,
          country: payload.countryOfOrigin,
        },
        { onConflict: "candidate_id" },
      );

    if (privateError) {
      return NextResponse.json(
        { error: privateError.message },
        { status: 500 },
      );
    }

    await supabase.from("case_stages").upsert(
      {
        candidate_id: candidate.id,
        stage: "intake",
        stage_status: "completed",
        notes: "Candidate completed onboarding intake form.",
        set_by_user_id: userId,
      },
      { onConflict: "candidate_id,stage" },
    );

    await recordAuditEvent({
      action: "candidate_intake_submitted",
      resourceType: "candidates",
      resourceId: candidate.id,
      accessLevel: "sensitive",
    });

    return NextResponse.json({
      candidateId: candidate.id,
      status: "ok",
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequestFromZod(error);
    }

    return NextResponse.json(
      { error: "Unexpected error while saving intake details." },
      { status: 500 },
    );
  }
}
