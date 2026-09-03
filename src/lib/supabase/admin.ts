import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// DANGER: bypasses Row Level Security entirely.
// Import this ONLY from trusted server-only code paths that need to act
// across users — e.g. the reminder scheduler resolving due notifications.
// Never import from a client component, a route handler that echoes
// request input back into a query, or anywhere reachable by user input
// without independent authorization checks.
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient must never run in the browser.');
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
