import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

export interface AuthContext {
  userId: string;
  role: UserRole;
  email: string;
}

export async function getAuthContext(userId: string): Promise<AuthContext | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("id, role, email")
    .eq("id", userId)
    .single();

  if (!data) return null;
  return { userId: data.id, role: data.role, email: data.email };
}

export function roleDashboardPath(role: UserRole): string {
  switch (role) {
    case "candidate":
      return "/candidate";
    case "employer":
      return "/employer";
    case "admin":
      return "/admin";
    default:
      return "/";
  }
}

export const PUBLIC_PATHS = ["/", "/login", "/register", "/register/candidate", "/register/employer"];
export const AUTH_PATHS = ["/login", "/register", "/register/candidate", "/register/employer"];
