import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  context: { params: Promise<{ candidateId: string }> },
) {
  try {
    await requireAuthenticatedUser(["employer"]);
    const { candidateId } = await context.params;
    const supabase = await createSupabaseServerClient();

    // Sensitive access is delegated to a SECURITY DEFINER RPC
    // that validates candidate approval and writes audit logs.
    const { data, error } = await supabase.rpc(
      "get_candidate_contact_for_employer",
      { p_candidate_id: candidateId },
    );

    if (error) {
      return NextResponse.json(
        { error: "Contact details are not available for this candidate." },
        { status: 403 },
      );
    }

    await recordAuditEvent({
      action: "employer_retrieved_candidate_contact",
      resourceType: "candidate_private_details",
      resourceId: candidateId,
      accessLevel: "sensitive",
    });

    return NextResponse.json({ contact: data?.[0] ?? null });
  } catch {
    return NextResponse.json(
      { error: "Unable to retrieve candidate contact details." },
      { status: 500 },
    );
  }
}
