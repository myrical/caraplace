// Supabase Realtime subscriptions

import { supabase, isSupabaseConfigured } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type PixelPayload = {
  id: number;
  x: number;
  y: number;
  color: number;
  agent_id: string;
  created_at: string;
};

export type ChatPayload = {
  id: string;
  agent_id: string | null;
  sender_type: string;
  sender_name: string;
  content: string;
  type: string;
  created_at: string;
};

let pixelChannel: RealtimeChannel | null = null;
let chatChannel: RealtimeChannel | null = null;

// Subscribe to pixel updates
export function subscribeToPixels(
  onPixel: (pixel: PixelPayload) => void
): () => void {
  // Skip if supabase not configured
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured, skipping pixel subscription');
    return () => {};
  }

  try {
    // Unsubscribe from existing channel
    if (pixelChannel) {
      supabase.removeChannel(pixelChannel);
    }

    pixelChannel = supabase
      .channel('pixels-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pixels',
        },
        (payload) => {
          onPixel(payload.new as PixelPayload);
        }
      )
      .subscribe();
  } catch (error) {
    console.error('Failed to subscribe to pixels:', error);
  }

  // Return unsubscribe function
  return () => {
    if (pixelChannel) {
      try {
        supabase.removeChannel(pixelChannel);
      } catch (e) {
        // Ignore cleanup errors
      }
      pixelChannel = null;
    }
  };
}

// Subscribe to chat messages
export function subscribeToChat(
  onMessage: (message: ChatPayload) => void
): () => void {
  // Skip if supabase not configured
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured, skipping chat subscription');
    return () => {};
  }

  try {
    // Unsubscribe from existing channel
    if (chatChannel) {
      supabase.removeChannel(chatChannel);
    }

    chatChannel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          onMessage(payload.new as ChatPayload);
        }
      )
      .subscribe();
  } catch (error) {
    console.error('Failed to subscribe to chat:', error);
  }

  // Return unsubscribe function
  return () => {
    if (chatChannel) {
      try {
        supabase.removeChannel(chatChannel);
      } catch (e) {
        // Ignore cleanup errors
      }
      chatChannel = null;
    }
  };
}
