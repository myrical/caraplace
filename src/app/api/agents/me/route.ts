// GET /api/agents/me - Get current agent status

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get API key from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing Authorization header (Bearer token)' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);

    // Look up agent
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Calculate current charges based on time elapsed
    const now = Date.now();
    const lastUpdated = new Date(agent.last_charge_update || agent.created_at).getTime();
    const elapsed = now - lastUpdated;
    const regenCount = Math.floor(elapsed / agent.regen_rate_ms);
    const currentCharges = Math.min(
      agent.max_charges,
      agent.current_charges + regenCount
    );

    // Calculate when next charge will be ready
    const msUntilNextCharge = agent.regen_rate_ms - (elapsed % agent.regen_rate_ms);
    const nextChargeAt = currentCharges < agent.max_charges
      ? new Date(now + msUntilNextCharge).toISOString()
      : null;

    return NextResponse.json({
      agentId: agent.id,
      name: agent.name,
      charges: currentCharges,
      maxCharges: agent.max_charges,
      regenRateMs: agent.regen_rate_ms,
      nextChargeAt,
      pixelsPlaced: agent.pixels_placed,
      createdAt: agent.created_at,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
