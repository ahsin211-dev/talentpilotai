import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { badRequestFromZod, parseJsonBody } from "@/lib/validation/http";
import { unlockRequestSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser(["employer"]);
    const payload = await parseJsonBody(req, unlockRequestSchema);
    const supabase = await createSupabaseServerClient();

    const { data: employer, error: employerError } = await supabase
      .from("employer_accounts")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: "Employer account missing." }, { status: 404 });
    }

    const { data: createdRequest, error } = await supabase
      .from("contact_unlock_requests")
      .upsert(
        {
          employer_id: employer.id,
          candidate_id: payload.candidateId,
          message: payload.message ?? null,
          status: "pending",
        },
        { onConflict: "employer_id,candidate_id" },
      )
      .select("id")
      .single();

    if (error || !createdRequest) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to create unlock request." },
        { status: 500 },
      );
    }

    await recordAuditEvent({
      action: "employer_contact_unlock_requested",
      resourceType: "contact_unlock_requests",
      resourceId: createdRequest.id,
      metadata: {
        candidateId: payload.candidateId,
      },
      accessLevel: "sensitive",
    });

    return NextResponse.json({ requestId: createdRequest.id, status: "pending" });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequestFromZod(error);
    }

    return NextResponse.json(
      { error: "Unable to submit contact unlock request." },
      { status: 500 },
    );
  }
}
