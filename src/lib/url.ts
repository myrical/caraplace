import type { NextRequest } from 'next/server';

/**
 * Best-effort public base URL.
 *
 * Priority:
 * 1) NEXT_PUBLIC_APP_URL (recommended in prod, e.g. https://www.caraplace.com)
 * 2) Infer from request Host + X-Forwarded-Proto (works behind proxies/CDNs)
 */
export function getPublicBaseUrl(req?: NextRequest | Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env && env.startsWith('http')) return env.replace(/\/$/, '');

  if (req) {
    // NextRequest has headers.get()
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    if (host) return `${proto}://${host}`;
  }

  // Fallback (last resort)
  return 'https://www.caraplace.com';
}
