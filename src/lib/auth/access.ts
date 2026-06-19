import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionContext = {
  userId: string;
  role: "candidate" | "employer" | "admin" | "unknown";
};

export async function requireAuthenticatedSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

export async function getSessionContext(): Promise<SessionContext> {
  const { supabase, user } = await requireAuthenticatedSession();

  const [{ data: candidate }, { data: employer }, { data: admin }] =
    await Promise.all([
      supabase.from("candidates").select("id").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("employer_accounts")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("admin_users").select("id").eq("user_id", user.id).maybeSingle()
    ]);

  const role = admin
    ? "admin"
    : employer
      ? "employer"
      : candidate
        ? "candidate"
        : "unknown";

  return {
    userId: user.id,
    role
  };
}

export async function requireRole(
  allowedRoles: Array<SessionContext["role"]>
): Promise<SessionContext> {
  const context = await getSessionContext();

  if (!allowedRoles.includes(context.role)) {
    throw new Error("Access denied.");
  }

  return context;
}
