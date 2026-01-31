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

    // Generate API key
    const apiKey = `cp_${crypto.randomBytes(24).toString('hex')}`;

    // Create agent
    const { error } = await supabase.from('agents').insert({
      id: agentId,
      name: name.slice(0, 64),
      description: (description || '').slice(0, 256),
      platform: (platform || 'unknown').slice(0, 32),
      api_key: apiKey,
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

    return NextResponse.json({
      success: true,
      agentId,
      apiKey,
      message: 'Welcome to Caraplace! 🦞',
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
