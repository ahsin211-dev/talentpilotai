import { requireRole } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    await requireRole("employer");
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const trade = searchParams.get("trade");
    const country = searchParams.get("country");

    let query = supabase
      .from("candidate_profiles_public_redacted")
      .select(
        "candidate_id,display_name,country_of_residence,primary_trade,skills,qualifications,years_experience,availability_date,visa_stage,professional_summary"
      )
      .eq("is_employer_visible", true)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (trade) {
      query = query.ilike("primary_trade", `%${trade}%`);
    }

    if (country) {
      query = query.eq("country_of_residence", country);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return jsonOk({ candidates: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}
