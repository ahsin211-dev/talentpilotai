import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerSchema } from "@/lib/validation/schemas";
import { writeAuditLog, AuditActions } from "@/lib/audit/log";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, role } = parsed.data;
    const supabase = createClient();
    const admin = createAdminClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }

    const { error: profileError } = await admin.from("user_profiles").insert({
      id: authData.user.id,
      role,
      email,
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (role === "candidate") {
      const { data: intakeStage } = await admin
        .from("case_stages")
        .select("id")
        .eq("code", "intake")
        .single();

      await admin.from("candidates").insert({
        user_id: authData.user.id,
        case_stage_id: intakeStage?.id,
      });
    }

    await writeAuditLog({
      actorId: authData.user.id,
      actorRole: role,
      action: AuditActions.LOGIN,
      resourceType: "user",
      resourceId: authData.user.id,
      metadata: { event: "registration" },
    });

    return NextResponse.json({ user: authData.user, role });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
