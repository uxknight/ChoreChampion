import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Service-role client — SERVER ONLY (used by the Sunday-tally cron route).
// Never import this into a client component.
export function supabaseAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
