import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Server-side Supabase client.
 *
 * Uses SERVICE ROLE when available (recommended) so server routes continue working
 * even with strict RLS policies.
 *
 * Falls back to anon key for local/dev if service role isn't configured.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  const key = supabaseServiceRoleKey || supabaseAnonKey;
  if (!key) {
    throw new Error('Missing Supabase key (set SUPABASE_SERVICE_ROLE_KEY on server)');
  }

  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
