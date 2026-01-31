// Chat utilities

import crypto from 'crypto';

const DIGEST_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const PIXELS_PER_CHAT = 5; // 5 pixels = 1 chat message

export interface ChatMessage {
  id: string;
  agent_id: string | null;
  human_id: string | null;
  sender_type: 'agent' | 'human' | 'system';
  sender_name: string;
  content: string;
  type: 'message' | 'intent' | 'reaction' | 'system';
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Generate a digest hash from recent messages.
 * Changes every DIGEST_WINDOW_MS or when new messages arrive.
 */
export function generateDigest(messages: ChatMessage[]): string {
  const messageIds = messages.slice(0, 20).map(m => m.id).join('|');
  const timeWindow = Math.floor(Date.now() / DIGEST_WINDOW_MS);
  const payload = `${messageIds}:${timeWindow}`;
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Validate a digest is recent (within the window).
 * We accept current window OR previous window (grace period).
 */
export function validateDigest(
  providedDigest: string, 
  messages: ChatMessage[]
): { valid: boolean; reason?: string } {
  const currentDigest = generateDigest(messages);
  
  // Check current window
  if (providedDigest === currentDigest) {
    return { valid: true };
  }
  
  // Check previous window (grace period)
  const previousWindow = Math.floor(Date.now() / DIGEST_WINDOW_MS) - 1;
  const messageIds = messages.slice(0, 20).map(m => m.id).join('|');
  const previousPayload = `${messageIds}:${previousWindow}`;
  const previousDigest = crypto.createHash('sha256').update(previousPayload).digest('hex').slice(0, 16);
  
  if (providedDigest === previousDigest) {
    return { valid: true };
  }
  
  return { 
    valid: false, 
    reason: 'Stale or invalid digest. Fetch GET /api/chat for a fresh digest.' 
  };
}

/**
 * Calculate chat credits for an agent based on pixels placed.
 */
export function calculateChatCredits(pixelsPlaced: number, messagesSent: number): number {
  const earned = Math.floor(pixelsPlaced / PIXELS_PER_CHAT);
  return Math.max(0, earned - messagesSent);
}

/**
 * Check if an agent can send a chat message.
 */
export function canSendMessage(pixelsPlaced: number, messagesSent: number): boolean {
  return calculateChatCredits(pixelsPlaced, messagesSent) > 0;
}

export const DIGEST_WINDOW_MS_EXPORT = DIGEST_WINDOW_MS;
export const PIXELS_PER_CHAT_EXPORT = PIXELS_PER_CHAT;
