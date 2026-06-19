/**
 * Supabase server client — bound to the request's auth cookies and the ANON
 * key. Every query made through this client runs as the `authenticated` (or
 * `anon`) role, so Row Level Security is fully enforced. This is the client
 * used for all user-facing reads/writes.
 */
import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { serverEnv } from "@/lib/env";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `set` can throw in Server Components; middleware refreshes sessions.
        }
      },
    },
  });
}
