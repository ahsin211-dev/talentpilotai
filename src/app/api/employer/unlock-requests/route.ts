import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/access";
import { contactUnlockRequestSchema } from "@/lib/domain";
import { logAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = contactUnlockRequestSchema.parse(await request.json());
    const context = await requireRole(["employer"]);
    const supabase = await createSupabaseServerClient();

    const { data: employer } = await supabase
      .from("employer_accounts")
      .select("id")
      .eq("user_id", context.userId)
      .single();

    if (!employer) {
      throw new Error("Employer account not found.");
    }

    const { data, error } = await supabase
      .from("contact_unlock_requests")
      .insert({
        employer_id: employer.id,
        candidate_id: payload.candidateId,
        rationale: payload.rationale,
        status: "pending"
      })
      .select("id")
      .single();

    if (error || !data) {
      throw error ?? new Error("Unlock request was not created.");
    }

    await logAuditEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      action: "employer.unlock.requested",
      targetTable: "contact_unlock_requests",
      targetId: data.id,
      metadata: {
        candidateId: payload.candidateId
      }
    });

    return NextResponse.json({ ok: true, requestId: data.id });
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
