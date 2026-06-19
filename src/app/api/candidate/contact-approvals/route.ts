import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { badRequestFromZod, parseJsonBody } from "@/lib/validation/http";
import { contactApprovalSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser(["candidate"]);
    const payload = await parseJsonBody(req, contactApprovalSchema);
    const supabase = await createSupabaseServerClient();

    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const approvedAt = payload.status === "approved" ? new Date().toISOString() : null;
    const normalizedStatus = payload.status === "approved" ? "approved" : "rejected";

    const { error: approvalError } = await supabase
      .from("candidate_contact_approvals")
      .upsert(
        {
          candidate_id: candidate.id,
          employer_id: payload.employerId,
          unlock_request_id: payload.unlockRequestId ?? null,
          status: normalizedStatus,
          approved_by_candidate_user_id: userId,
          approved_at: approvedAt,
        },
        { onConflict: "candidate_id,employer_id" },
      );

    if (approvalError) {
      return NextResponse.json({ error: approvalError.message }, { status: 500 });
    }

    if (payload.unlockRequestId) {
      await supabase
        .from("contact_unlock_requests")
        .update({
          status: normalizedStatus,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", payload.unlockRequestId);
    }

    await recordAuditEvent({
      action: "candidate_contact_approval_updated",
      resourceType: "candidate_contact_approvals",
      metadata: {
        employerId: payload.employerId,
        status: normalizedStatus,
      },
      accessLevel: "sensitive",
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequestFromZod(error);
    }

    return NextResponse.json(
      { error: "Unable to process contact approval." },
      { status: 500 },
    );
  }
}
