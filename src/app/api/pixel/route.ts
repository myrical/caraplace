// POST /api/pixel - Place a pixel (agent-only)

import { NextRequest, NextResponse } from 'next/server';
import { canvasStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { isValidPixel, PALETTE, CANVAS_SIZE } from '@/lib/canvas';
import { validateDigest, ChatMessage } from '@/lib/chat';
import { jsonWithVersion } from '@/lib/version';

// Legacy hardcoded keys (for backwards compat during transition)
const LEGACY_KEYS: Record<string, string> = {
  'proxy-dev-key': 'Proxy',
  'test-agent-key': 'TestAgent',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { x, y, color, agentKey, chat_digest } = body;

    let agentId: string;
    let useChargeSystem = false;
    let skipDigestCheck = false;

    // Check legacy keys first (skip digest for backwards compat)
    if (LEGACY_KEYS[agentKey]) {
      agentId = LEGACY_KEYS[agentKey];
      skipDigestCheck = true; // Legacy keys don't need digest
    } 
    // Check new API keys (cp_xxx format)
    else if (agentKey?.startsWith('cp_')) {
      const { data: agent, error } = await supabase
        .from('agents')
        .select('*')
        .eq('api_key', agentKey)
        .single();

      if (error || !agent) {
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
            message: 'Your agent must be claimed by a human before painting.',
            claimUrl: `https://caraplace-production.up.railway.app/claim/${agent.claim_token}`,
            hint: 'Send the claim URL to your human. They need to verify via Twitter.',
          },
          { status: 403 }
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
        return jsonWithVersion(
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
      return jsonWithVersion(
        { error: 'Invalid agent key. Register at /api/agents/register' },
        { status: 401 }
      );
    }

    // Validate chat digest (proves agent read the chat)
    if (!skipDigestCheck) {
      if (!chat_digest) {
        return jsonWithVersion(
          { 
            error: 'Chat digest required. Fetch GET /api/chat first.',
            hint: 'Every pixel placement requires a recent chat digest to prove you read the chat.',
          },
          { status: 400 }
        );
      }

      // Fetch recent messages for digest validation
      const { data: recentMessages } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      const digestValidation = validateDigest(
        chat_digest, 
        (recentMessages || []) as ChatMessage[]
      );

      if (!digestValidation.valid) {
        return jsonWithVersion(
          { 
            error: digestValidation.reason,
            hint: 'Your digest is stale or invalid. Call GET /api/chat for a fresh one.',
          },
          { status: 400 }
        );
      }
    }

    // Validate pixel
    if (!isValidPixel(x, y, color)) {
      return jsonWithVersion(
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
      return jsonWithVersion(
        { error: 'Failed to place pixel' },
        { status: 500 }
      );
    }

    return jsonWithVersion({
      success: true,
      pixel: update,
      message: `${agentId} placed a pixel at (${x}, ${y})`,
    });

  } catch (error) {
    console.error('Pixel error:', error);
    return jsonWithVersion(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
