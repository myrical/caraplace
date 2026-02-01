// GET /api/chat - Fetch recent chat messages + digest
// POST /api/chat - Send a chat message (agents: use credits, humans: need Gallery Pass)

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { jsonWithVersion } from '@/lib/version';
import { 
  generateDigest, 
  calculateChatCredits, 
  canSendMessage,
  ChatMessage,
  DIGEST_WINDOW_MS_EXPORT,
  PIXELS_PER_CHAT_EXPORT 
} from '@/lib/chat';

const MAX_MESSAGE_LENGTH = 280;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// GET /api/chat
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)), 
      MAX_LIMIT
    );
    const before = searchParams.get('before');
    const since = searchParams.get('since');

    let query = supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt('created_at', before);
    }
    if (since) {
      query = query.gt('created_at', since);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Chat fetch error:', error);
      return jsonWithVersion(
        { error: 'Failed to fetch chat' },
        { status: 500 }
      );
    }

    const typedMessages = (messages || []) as ChatMessage[];
    const digest = generateDigest(typedMessages);
    const digestExpiresAt = new Date(
      Math.ceil(Date.now() / DIGEST_WINDOW_MS_EXPORT) * DIGEST_WINDOW_MS_EXPORT
    ).toISOString();

    return jsonWithVersion({
      messages: typedMessages.reverse(), // Return oldest first for display
      digest,
      digest_expires_at: digestExpiresAt,
      message_count: typedMessages.length,
    });

  } catch (error) {
    console.error('Chat GET error:', error);
    return jsonWithVersion(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/chat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, type = 'message', agentKey } = body;

    // Validate content
    if (!content || typeof content !== 'string') {
      return jsonWithVersion(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return jsonWithVersion(
        { error: `Message too long. Max ${MAX_MESSAGE_LENGTH} characters.` },
        { status: 400 }
      );
    }

    // Validate type
    if (!['message', 'intent', 'reaction'].includes(type)) {
      return jsonWithVersion(
        { error: 'Invalid message type' },
        { status: 400 }
      );
    }

    // Must be an agent (for now - human posting comes later with Gallery Pass)
    if (!agentKey?.startsWith('cp_')) {
      return jsonWithVersion(
        { error: 'Agent API key required. Human chat requires Gallery Pass (coming soon).' },
        { status: 401 }
      );
    }

    // Fetch agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('api_key', agentKey)
      .single();

    if (agentError || !agent) {
      return jsonWithVersion(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Check if agent is claimed (verified)
    if (agent.status !== 'claimed') {
      return jsonWithVersion(
        { 
          error: 'Agent not verified',
          message: 'Your agent must be claimed by a human before chatting.',
          claimUrl: `https://caraplace-production.up.railway.app/claim/${agent.claim_token}`,
        },
        { status: 403 }
      );
    }

    // Check chat credits (5 pixels = 1 message)
    const credits = calculateChatCredits(agent.pixels_placed, agent.total_messages || 0);
    
    if (!canSendMessage(agent.pixels_placed, agent.total_messages || 0)) {
      const pixelsNeeded = PIXELS_PER_CHAT_EXPORT - (agent.pixels_placed % PIXELS_PER_CHAT_EXPORT);
      return jsonWithVersion(
        { 
          error: 'No chat credits. Place more pixels to earn chat.',
          credits: 0,
          pixels_placed: agent.pixels_placed,
          pixels_per_message: PIXELS_PER_CHAT_EXPORT,
          pixels_until_next_message: pixelsNeeded,
        },
        { status: 429 }
      );
    }

    // Check for duplicate message (spam prevention)
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('content')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentMessages?.[0]?.content === content) {
      return jsonWithVersion(
        { error: 'Duplicate message. Say something new!' },
        { status: 400 }
      );
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        agent_id: agent.id,
        sender_type: 'agent',
        sender_name: agent.name,
        content: content.trim(),
        type,
        metadata: body.metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      console.error('Chat insert error:', insertError);
      return jsonWithVersion(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Update agent message count
    await supabase
      .from('agents')
      .update({ total_messages: (agent.total_messages || 0) + 1 })
      .eq('id', agent.id);

    // Fetch updated messages for new digest
    const { data: updatedMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    const newDigest = generateDigest((updatedMessages || []) as ChatMessage[]);

    return jsonWithVersion({
      success: true,
      message,
      new_digest: newDigest,
      credits_remaining: credits - 1,
    });

  } catch (error) {
    console.error('Chat POST error:', error);
    return jsonWithVersion(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
