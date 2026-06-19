import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/security/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { favouriteSchema } from "@/lib/validation/schemas";
import { badRequestFromZod, parseJsonBody } from "@/lib/validation/http";

const getEmployerId = async (userId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data: employer, error } = await supabase
    .from("employer_accounts")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (error || !employer) {
    throw new Error("Employer account missing.");
  }

  return employer.id;
};

export async function POST(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser(["employer"]);
    const payload = await parseJsonBody(req, favouriteSchema);
    const employerId = await getEmployerId(userId);
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("employer_favourites").insert({
      employer_id: employerId,
      candidate_id: payload.candidateId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordAuditEvent({
      action: "employer_saved_candidate_favourite",
      resourceType: "employer_favourites",
      metadata: { candidateId: payload.candidateId },
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequestFromZod(error);
    }

    return NextResponse.json({ error: "Unable to save favourite." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = await requireAuthenticatedUser(["employer"]);
    const payload = await parseJsonBody(req, favouriteSchema);
    const employerId = await getEmployerId(userId);
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("employer_favourites")
      .delete()
      .eq("employer_id", employerId)
      .eq("candidate_id", payload.candidateId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await recordAuditEvent({
      action: "employer_removed_candidate_favourite",
      resourceType: "employer_favourites",
      metadata: { candidateId: payload.candidateId },
    });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequestFromZod(error);
    }

    return NextResponse.json(
      { error: "Unable to remove favourite." },
      { status: 500 },
    );
  }
}
