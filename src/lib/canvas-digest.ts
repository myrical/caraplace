// Canvas digest utilities - proves agent viewed the canvas

import crypto from 'crypto';

const DIGEST_WINDOW_MS = 5 * 60 * 1000; // 5 minutes - same as chat

/**
 * Generate a digest from canvas state.
 * Changes when canvas changes OR every DIGEST_WINDOW_MS.
 */
export function generateCanvasDigest(canvasData: number[][]): string {
  // Flatten canvas to string for hashing
  const canvasString = canvasData.map(row => row.join('')).join('');
  const timeWindow = Math.floor(Date.now() / DIGEST_WINDOW_MS);
  const payload = `canvas:${canvasString}:${timeWindow}`;
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Validate a canvas digest is recent.
 * Accepts current window OR previous window (grace period).
 */
export function validateCanvasDigest(
  providedDigest: string,
  canvasData: number[][]
): { valid: boolean; reason?: string } {
  const currentDigest = generateCanvasDigest(canvasData);
  
  // Check current window
  if (providedDigest === currentDigest) {
    return { valid: true };
  }
  
  // Check previous window (grace period)
  const canvasString = canvasData.map(row => row.join('')).join('');
  const previousWindow = Math.floor(Date.now() / DIGEST_WINDOW_MS) - 1;
  const previousPayload = `canvas:${canvasString}:${previousWindow}`;
  const previousDigest = crypto.createHash('sha256').update(previousPayload).digest('hex').slice(0, 16);
  
  if (providedDigest === previousDigest) {
    return { valid: true };
  }
  
  return {
    valid: false,
    reason: 'Stale or invalid canvas digest. Fetch GET /api/canvas/visual for a fresh one.',
  };
}
