import { NextResponse } from "next/server";

import { requireAuthenticatedSession } from "@/lib/auth/access";
import { candidateIntakeSchema } from "@/lib/domain";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/security/audit";
import {
  makeEmployerDisplayName,
  redactSensitiveText
} from "@/lib/security/redaction";

export async function POST(request: Request) {
  try {
    const payload = candidateIntakeSchema.parse(await request.json());
    const { supabase: sessionClient, user } = await requireAuthenticatedSession();
    const supabase = createSupabaseAdminClient();

    const [{ data: employer }, { data: admin }] = await Promise.all([
      sessionClient
        .from("employer_accounts")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(),
      sessionClient.from("admin_users").select("id").eq("user_id", user.id).maybeSingle()
    ]);

    if (employer || admin) {
      throw new Error(
        "Existing employer and admin accounts cannot use the candidate intake endpoint."
      );
    }

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .upsert(
        {
          user_id: user.id,
          given_name: payload.givenName,
          surname: payload.surname,
          country_of_residence: payload.countryOfResidence,
          nationality: payload.nationality,
          occupation_title: payload.occupationTitle,
          years_experience: payload.yearsExperience,
          visa_interest: payload.visaInterest,
          consent_accepted_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();

    if (candidateError || !candidate) {
      throw candidateError ?? new Error("Candidate record was not created.");
    }

    const privateDetailsError = await supabase
      .from("candidate_private_details")
      .upsert(
        {
          candidate_id: candidate.id,
          email: payload.email,
          phone: payload.phone
        },
        { onConflict: "candidate_id" }
      )
      .then(({ error }) => error);

    if (privateDetailsError) {
      throw privateDetailsError;
    }

    const publicProfileError = await supabase
      .from("candidate_profiles_public_redacted")
      .upsert(
        {
          candidate_id: candidate.id,
          display_name: makeEmployerDisplayName(payload.givenName, payload.surname),
          headline: payload.occupationTitle,
          summary_redacted: redactSensitiveText(payload.summary),
          skills: payload.skills,
          approval_status: "pending_review"
        },
        { onConflict: "candidate_id" }
      )
      .then(({ error }) => error);

    if (publicProfileError) {
      throw publicProfileError;
    }

    await logAuditEvent({
      actorUserId: user.id,
      actorRole: "candidate",
      action: "candidate.intake.submitted",
      targetTable: "candidates",
      targetId: candidate.id,
      metadata: {
        skillsCount: payload.skills.length,
        occupationTitle: payload.occupationTitle
      }
    });

    return NextResponse.json({
      ok: true,
      candidateId: candidate.id,
      status: "pending_review"
    });
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
