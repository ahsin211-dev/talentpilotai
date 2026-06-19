import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACTIVE_SUBSCRIPTION_STATES = ["active", "trialing"] as const;

export async function GET(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser(["employer"]);
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);

    const { data: employer, error: employerError } = await supabase
      .from("employer_accounts")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: "Employer account missing." }, { status: 404 });
    }

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("state")
      .eq("employer_id", employer.id)
      .single();

    if (!subscription || !ACTIVE_SUBSCRIPTION_STATES.includes(subscription.state)) {
      return NextResponse.json(
        {
          error:
            "An active employer subscription is required to browse candidates.",
        },
        { status: 402 },
      );
    }

    let query = supabase
      .from("employer_candidate_directory")
      .select(
        "candidate_id,headline,professional_summary,rewritten_summary,key_skills,years_experience,country,availability,occupation_code,visa_stage,published_at",
      )
      .order("published_at", { ascending: false })
      .limit(50);

    const occupationCode = searchParams.get("occupationCode");
    const country = searchParams.get("country");
    const minExperience = searchParams.get("minExperience");

    if (occupationCode) {
      query = query.eq("occupation_code", occupationCode);
    }
    if (country) {
      query = query.ilike("country", country);
    }
    if (minExperience) {
      const parsed = Number.parseInt(minExperience, 10);
      if (!Number.isNaN(parsed)) {
        query = query.gte("years_experience", parsed);
      }
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordAuditEvent({
      action: "employer_browse_redacted_candidates",
      resourceType: "candidate_profiles_public_redacted",
      metadata: {
        resultCount: data.length,
        filters: {
          occupationCode,
          country,
          minExperience,
        },
      },
    });

    return NextResponse.json({ candidates: data });
  } catch {
    return NextResponse.json(
      { error: "Unable to load redacted candidate profiles." },
      { status: 500 },
    );
  }
}
