import { requireRole } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    candidateId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole("employer");
    const { candidateId } = await context.params;
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("get_approved_candidate_contact", {
      p_candidate_id: candidateId
    });

    if (error) {
      throw new Error(error.message);
    }

    return jsonOk({ contact: data?.[0] ?? null });
  } catch (error) {
    return jsonError(error);
  }
}
