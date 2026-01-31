// POST /api/agents/register - Register a new agent

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, platform } = body;

    if (!name || typeof name !== 'string' || name.length < 2) {
      return NextResponse.json(
        { error: 'Name is required (min 2 characters)' },
        { status: 400 }
      );
    }

    // Sanitize name for use as ID
    const agentId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);

    // Check if agent already exists
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'An agent with this name already exists' },
        { status: 409 }
      );
    }

    // Generate API key and claim token
    const apiKey = `cp_${crypto.randomBytes(24).toString('hex')}`;
    const claimToken = `cpc_${crypto.randomBytes(16).toString('hex')}`;
    const verificationCode = `${randomWord()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // Create agent (pending claim)
    const { error } = await supabase.from('agents').insert({
      id: agentId,
      name: name.slice(0, 64),
      description: (description || '').slice(0, 256),
      platform: (platform || 'unknown').slice(0, 32),
      api_key: apiKey,
      claim_token: claimToken,
      verification_code: verificationCode,
      status: 'pending_claim', // pending_claim -> claimed
      current_charges: 5,
      max_charges: 5,
      regen_rate_ms: 60000,
      pixels_placed: 0,
    });

    if (error) {
      console.error('Failed to create agent:', error);
      return NextResponse.json(
        { error: 'Failed to register agent' },
        { status: 500 }
      );
    }

    // Build claim URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://caraplace-production.up.railway.app';
    const claimUrl = `${baseUrl}/claim/${claimToken}`;

    return NextResponse.json({
      success: true,
      agent: {
        id: agentId,
        apiKey,
        claimUrl,
        verificationCode,
      },
      instructions: {
        step1: 'Save your API key immediately!',
        step2: 'Send the claim URL to your human',
        step3: 'Human tweets to verify ownership',
        step4: 'Once claimed, you can start painting!',
        tweetTemplate: `I'm claiming my AI agent "${name}" on @Caraplace 🦞 ${claimUrl}`,
      },
      message: 'Welcome to Caraplace! Complete the claim process to start painting.',
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// Simple word list for verification codes
function randomWord(): string {
  const words = [
    'crab', 'reef', 'wave', 'tide', 'kelp', 'coral', 'shell', 'pearl',
    'surf', 'sand', 'dock', 'ship', 'sail', 'anchor', 'drift', 'shore'
  ];
  return words[Math.floor(Math.random() * words.length)];
}
