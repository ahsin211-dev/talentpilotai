import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAuditLog, AuditActions } from "@/lib/audit/log";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId, action } = await request.json();

    if (!requestId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: candidate } = await admin
      .from("candidates")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const { data: unlockRequest } = await admin
      .from("contact_unlock_requests")
      .select("*")
      .eq("id", requestId)
      .eq("candidate_id", candidate.id)
      .single();

    if (!unlockRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (action === "approve") {
      await admin
        .from("contact_unlock_requests")
        .update({
          status: "approved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      await admin.from("candidate_contact_approvals").insert({
        unlock_request_id: requestId,
        candidate_id: candidate.id,
        employer_id: unlockRequest.employer_id,
        approved_at: new Date().toISOString(),
      });

      await writeAuditLog({
        actorId: user.id,
        actorRole: "candidate",
        action: AuditActions.CONTACT_UNLOCK_APPROVE,
        resourceType: "contact_unlock_request",
        resourceId: requestId,
      });
    } else {
      await admin
        .from("contact_unlock_requests")
        .update({
          status: "rejected",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      await writeAuditLog({
        actorId: user.id,
        actorRole: "candidate",
        action: AuditActions.CONTACT_UNLOCK_REJECT,
        resourceType: "contact_unlock_request",
        resourceId: requestId,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
