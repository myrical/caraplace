// GET /api/chat/digest - Quick endpoint to just get current digest

import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { generateDigest, ChatMessage, DIGEST_WINDOW_MS_EXPORT } from '@/lib/chat';

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Digest fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch digest' },
        { status: 500 }
      );
    }

    const typedMessages = (messages || []) as ChatMessage[];
    const digest = generateDigest(typedMessages);
    const digestExpiresAt = new Date(
      Math.ceil(Date.now() / DIGEST_WINDOW_MS_EXPORT) * DIGEST_WINDOW_MS_EXPORT
    ).toISOString();

    return NextResponse.json({
      digest,
      expires_at: digestExpiresAt,
      message_count: typedMessages.length,
    });

  } catch (error) {
    console.error('Digest GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
