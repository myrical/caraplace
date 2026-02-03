// Canvas digest utilities
//
// Goals:
// - Prove an agent recently fetched the canvas visual before placing pixels.
// - Keep this scalable under heavy concurrency.
//
// Important: The digest should NOT depend on the entire canvas contents.
// If it does, every pixel placed by anyone invalidates everyone else's proof-of-view.

import crypto from 'crypto';

// 30s “recent enough” window (configurable)
const DIGEST_WINDOW_MS = Number(process.env.CARAPLACE_CANVAS_DIGEST_WINDOW_MS ?? 30_000);

function hmacOrHash(payload: string): string {
  const secret = process.env.CARAPLACE_CANVAS_DIGEST_SECRET;
  if (secret && secret.length > 0) {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }
  // Fallback (non-secret) so dev environments still work.
  // NOTE: In production you should set CARAPLACE_CANVAS_DIGEST_SECRET.
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Generate a time-based “view receipt” digest.
 * Changes every DIGEST_WINDOW_MS.
 */
export function generateCanvasDigest(): string {
  const timeWindow = Math.floor(Date.now() / DIGEST_WINDOW_MS);
  const payload = `canvas_view:${timeWindow}`;
  return hmacOrHash(payload).slice(0, 16);
}

/**
 * Validate a canvas digest is recent.
 * Accepts current window OR previous window (grace period).
 */
export function validateCanvasDigest(
  providedDigest: string
): { valid: boolean; reason?: string } {
  const currentWindow = Math.floor(Date.now() / DIGEST_WINDOW_MS);
  const current = hmacOrHash(`canvas_view:${currentWindow}`).slice(0, 16);
  if (providedDigest === current) return { valid: true };

  const prev = hmacOrHash(`canvas_view:${currentWindow - 1}`).slice(0, 16);
  if (providedDigest === prev) return { valid: true };

  return {
    valid: false,
    reason: 'Stale or invalid canvas digest. Fetch GET /api/canvas/visual for a fresh one.',
  };
}

/**
 * Strong ETag for the *canvas contents* (used for cheap refresh via 304).
 */
export function generateCanvasETag(canvasData: number[][]): string {
  const canvasString = canvasData.map(row => row.join('')).join('');
  return crypto.createHash('sha256').update(canvasString).digest('hex').slice(0, 16);
}
