import { supabase } from '@/lib/supabase';
import { hashApiKey } from '@/lib/api-key';

/**
 * Fetch an agent record by API key.
 *
 * Migration-friendly:
 * - Prefer api_key_hash lookup (new)
 * - Fallback to api_key lookup (old) if api_key_hash column isn't present yet
 */
export async function getAgentByApiKey(apiKey: string) {
  // 1) Try hashed lookup
  const apiKeyHash = hashApiKey(apiKey);
  {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('api_key_hash', apiKeyHash)
      .single();

    if (!error && data) return { agent: data, error: null };

    // If column doesn't exist (pre-migration), fall through to plaintext lookup.
    const msg = String(error?.message ?? '');
    const details = String((error as any)?.details ?? '');
    const combined = `${msg} ${details}`.toLowerCase();
    const missingColumn = combined.includes('api_key_hash') && combined.includes('column') && combined.includes('does not exist');

    if (!missingColumn) {
      // Not a schema-missing issue; return the original error.
      return { agent: null, error };
    }
  }

  // 2) Fallback plaintext lookup (temporary during migration)
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('api_key', apiKey)
    .single();

  return { agent: agent ?? null, error };
}
