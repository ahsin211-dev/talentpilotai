import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/access";
import { employerFavouriteSchema } from "@/lib/domain";
import { logAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = employerFavouriteSchema.parse(await request.json());
    const context = await requireRole(["employer"]);
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("employer_favourites").insert({
      candidate_id: payload.candidateId
    });

    if (error) {
      throw error;
    }

    await logAuditEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      action: "employer.favourite.created",
      targetTable: "employer_favourites",
      targetId: payload.candidateId,
      metadata: {
        candidateId: payload.candidateId
      }
    });

    return NextResponse.json({ ok: true });
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

export async function DELETE(request: Request) {
  try {
    const payload = employerFavouriteSchema.parse(await request.json());
    const context = await requireRole(["employer"]);
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("employer_favourites")
      .delete()
      .eq("candidate_id", payload.candidateId);

    if (error) {
      throw error;
    }

    await logAuditEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      action: "employer.favourite.deleted",
      targetTable: "employer_favourites",
      targetId: payload.candidateId,
      metadata: {
        candidateId: payload.candidateId
      }
    });

    return NextResponse.json({ ok: true });
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
