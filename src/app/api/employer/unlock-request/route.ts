import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unlockRequestSchema } from "@/lib/validation/schemas";
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

    const body = await request.json();
    const parsed = unlockRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: employer } = await admin
      .from("employer_accounts")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!employer) {
      return NextResponse.json({ error: "Employer account not found" }, { status: 404 });
    }

    const { data: subscription } = await admin
      .from("subscriptions")
      .select("status")
      .eq("employer_id", employer.id)
      .single();

    if (!subscription || !["active", "trialing"].includes(subscription.status)) {
      return NextResponse.json(
        { error: "Active subscription required" },
        { status: 403 }
      );
    }

    const { data: profile } = await admin
      .from("candidate_profiles_public_redacted")
      .select("id")
      .eq("candidate_id", parsed.data.candidateId)
      .eq("status", "approved")
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Candidate profile not available" },
        { status: 404 }
      );
    }

    const { data: existing } = await admin
      .from("contact_unlock_requests")
      .select("id, status")
      .eq("employer_id", employer.id)
      .eq("candidate_id", parsed.data.candidateId)
      .in("status", ["pending", "candidate_pending", "approved"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Request already exists", requestId: existing.id },
        { status: 409 }
      );
    }

    const { data: unlockRequest, error } = await admin
      .from("contact_unlock_requests")
      .insert({
        employer_id: employer.id,
        candidate_id: parsed.data.candidateId,
        message: parsed.data.message,
        status: "candidate_pending",
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeAuditLog({
      actorId: user.id,
      actorRole: "employer",
      action: AuditActions.CONTACT_UNLOCK_REQUEST,
      resourceType: "contact_unlock_request",
      resourceId: unlockRequest.id,
      metadata: { candidateId: parsed.data.candidateId },
    });

    return NextResponse.json({ requestId: unlockRequest.id });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
