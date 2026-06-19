import { unauthorized, forbidden } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

type AuthenticatedContext = {
  userId: string;
  role: AppRole;
};

export const requireAuthenticatedUser = async (
  allowedRoles?: AppRole[],
): Promise<AuthenticatedContext> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    unauthorized();
  }

  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleError || !roleRow?.role) {
    forbidden();
  }

  const role = roleRow.role as AppRole;
  if (allowedRoles && !allowedRoles.includes(role)) {
    forbidden();
  }

  return { userId: user.id, role };
};
