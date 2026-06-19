/**
 * Supabase service-role client. BYPASSES RLS.
 *
 * !! CRITICAL SECURITY BOUNDARY !!
 * - The service-role key must NEVER be sent to the browser.
 * - `import "server-only"` makes the build fail if this file is ever pulled
 *   into a client bundle.
 * - Use this client ONLY for trusted server operations that legitimately need
 *   to bypass RLS: the async worker, Stripe/WhatsApp webhooks, and admin
 *   provisioning. Always pair its use with an explicit audit-log entry.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
