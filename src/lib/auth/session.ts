/**
 * Server-side actor resolution. Determines whether the current authenticated
 * user is a candidate, employer, or admin by consulting the app tables through
 * the RLS-respecting server client. This mirrors the DB helper functions and is
 * used to route portals and authorize server actions — but it is NEVER the only
 * line of defence: RLS still enforces access at the database.
 */
import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActorType = "candidate" | "employer" | "admin" | "none";

export interface ResolvedActor {
  authUserId: string | null;
  type: ActorType;
  candidateId?: string;
  employerId?: string;
  adminId?: string;
  adminRole?: "reviewer" | "senior_reviewer" | "admin" | "super_admin";
}

export async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function resolveActor(): Promise<ResolvedActor> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { authUserId: null, type: "none" };

  // Each lookup is RLS-protected to "self only" rows, so these are safe.
  const [{ data: admin }, { data: employer }, { data: candidate }] = await Promise.all([
    supabase.from("admin_users").select("id, role").eq("auth_user_id", user.id).maybeSingle(),
    supabase.from("employer_accounts").select("id").eq("auth_user_id", user.id).maybeSingle(),
    supabase.from("candidates").select("id").eq("auth_user_id", user.id).maybeSingle(),
  ]);

  if (admin) {
    return {
      authUserId: user.id,
      type: "admin",
      adminId: admin.id,
      adminRole: admin.role,
    };
  }
  if (employer) {
    return { authUserId: user.id, type: "employer", employerId: employer.id };
  }
  if (candidate) {
    return { authUserId: user.id, type: "candidate", candidateId: candidate.id };
  }
  return { authUserId: user.id, type: "none" };
}

export async function requireActor(type: ActorType): Promise<ResolvedActor> {
  const actor = await resolveActor();
  if (actor.type !== type) {
    throw new Error(`Forbidden: expected ${type} actor`);
  }
  return actor;
}
