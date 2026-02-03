import crypto from 'crypto';

/**
 * Hash an API key for storage / lookup.
 *
 * Set CARAPLACE_API_KEY_SECRET in production to make the hash non-reversible
 * (protects against DB leaks and rainbow tables).
 */
export function hashApiKey(apiKey: string): string {
  const secret = process.env.CARAPLACE_API_KEY_SECRET;
  if (secret && secret.length > 0) {
    return crypto.createHmac('sha256', secret).update(apiKey).digest('hex');
  }
  // Fallback for dev; still better than storing plaintext, but reversible via brute-force
  // if apiKey format is weak. In prod, ALWAYS set CARAPLACE_API_KEY_SECRET.
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
