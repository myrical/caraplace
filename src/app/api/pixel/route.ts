// POST /api/pixel - Place a pixel (agent-only)

import { NextRequest, NextResponse } from 'next/server';
import { canvasStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { isValidPixel, PALETTE, CANVAS_SIZE } from '@/lib/canvas';

// Legacy hardcoded keys (for backwards compat during transition)
const LEGACY_KEYS: Record<string, string> = {
  'proxy-dev-key': 'Proxy',
  'test-agent-key': 'TestAgent',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { x, y, color, agentKey } = body;

    let agentId: string;
    let useChargeSystem = false;

    // Check legacy keys first
    if (LEGACY_KEYS[agentKey]) {
      agentId = LEGACY_KEYS[agentKey];
    } 
    // Check new API keys (cp_xxx format)
    else if (agentKey?.startsWith('cp_')) {
      const { data: agent, error } = await supabase
        .from('agents')
        .select('*')
        .eq('api_key', agentKey)
        .single();

      if (error || !agent) {
        return NextResponse.json(
          { error: 'Invalid API key' },
          { status: 401 }
        );
      }

      // Calculate current charges
      const now = Date.now();
      const lastUpdated = new Date(agent.last_charge_update || agent.created_at).getTime();
      const elapsed = now - lastUpdated;
      const regenCount = Math.floor(elapsed / agent.regen_rate_ms);
      const currentCharges = Math.min(
        agent.max_charges,
        agent.current_charges + regenCount
      );

      if (currentCharges < 1) {
        const msUntilCharge = agent.regen_rate_ms - (elapsed % agent.regen_rate_ms);
        return NextResponse.json(
          { 
            error: 'No charges available',
            charges: 0,
            nextChargeAt: new Date(now + msUntilCharge).toISOString(),
          },
          { status: 429 }
        );
      }

      agentId = agent.name;
      useChargeSystem = true;

      // Update agent charges
      await supabase
        .from('agents')
        .update({
          current_charges: currentCharges - 1,
          last_charge_update: new Date().toISOString(),
          pixels_placed: agent.pixels_placed + 1,
        })
        .eq('id', agent.id);
    } 
    else {
      return NextResponse.json(
        { error: 'Invalid agent key. Register at /api/agents/register' },
        { status: 401 }
      );
    }

    // Validate pixel
    if (!isValidPixel(x, y, color)) {
      return NextResponse.json(
        { 
          error: 'Invalid pixel', 
          details: {
            validX: `0-${CANVAS_SIZE - 1}`,
            validY: `0-${CANVAS_SIZE - 1}`,
            validColor: `0-${PALETTE.length - 1}`,
          }
        },
        { status: 400 }
      );
    }

    // Place pixel
    const update = await canvasStore.placePixel(x, y, color, agentId);

    if (!update) {
      return NextResponse.json(
        { error: 'Failed to place pixel' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pixel: update,
      message: `${agentId} placed a pixel at (${x}, ${y})`,
    });

  } catch (error) {
    console.error('Pixel error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
