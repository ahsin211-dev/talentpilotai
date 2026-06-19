import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "candidate" | "employer" | "admin";

export type AuthenticatedActor = {
  userId: string;
  role: AppRole;
};

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function getAuthenticatedActor(): Promise<AuthenticatedActor> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthorizationError("Authentication required");
  }

  const role = user.app_metadata?.app_role as AppRole | undefined;

  if (!role || !["candidate", "employer", "admin"].includes(role)) {
    throw new AuthorizationError("Account role has not been assigned");
  }

  return {
    userId: user.id,
    role
  };
}

export async function requireRole(...allowedRoles: AppRole[]): Promise<AuthenticatedActor> {
  const actor = await getAuthenticatedActor();

  if (!allowedRoles.includes(actor.role)) {
    throw new AuthorizationError("Role is not permitted for this operation");
  }

  return actor;
}
