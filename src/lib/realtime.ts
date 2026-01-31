// Supabase Realtime subscriptions

import { supabase } from './supabase';
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

  // Return unsubscribe function
  return () => {
    if (pixelChannel) {
      supabase.removeChannel(pixelChannel);
      pixelChannel = null;
    }
  };
}

// Subscribe to chat messages
export function subscribeToChat(
  onMessage: (message: ChatPayload) => void
): () => void {
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

  // Return unsubscribe function
  return () => {
    if (chatChannel) {
      supabase.removeChannel(chatChannel);
      chatChannel = null;
    }
  };
}
