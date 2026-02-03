// POST /api/pixel - Place a pixel (agent-only)

import { NextRequest, NextResponse } from 'next/server';
import { canvasStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { isValidPixel, PALETTE, CANVAS_SIZE } from '@/lib/canvas';
import { validateDigest, ChatMessage } from '@/lib/chat';
import { validateCanvasDigest } from '@/lib/canvas-digest';
import { jsonWithVersion } from '@/lib/version';
import { getAgentByApiKey } from '@/lib/agent-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { x, y, color, agentKey, chat_digest, canvas_digest } = body;

    let agentId: string;
    let useChargeSystem = false;
    let remainingCharges: number | null = null;
    let maxCharges: number | null = null;
    let nextChargeAt: string | null = null;

    // Only cp_xxx keys are accepted
    if (agentKey?.startsWith('cp_')) {
      const { agent, error } = await getAgentByApiKey(agentKey);

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

      // Calculate remaining charges for response
      remainingCharges = currentCharges - 1;
      maxCharges = agent.max_charges;
      const msUntilNextCharge = agent.regen_rate_ms - ((Date.now() - lastUpdated) % agent.regen_rate_ms);
      nextChargeAt = remainingCharges < agent.max_charges
        ? new Date(Date.now() + msUntilNextCharge).toISOString()
        : null;

      // Update agent charges
      await supabase
        .from('agents')
        .update({
          current_charges: remainingCharges,
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
    {
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

      // Validate canvas digest (proves agent viewed the canvas)
      if (!canvas_digest) {
        return jsonWithVersion(
          {
            error: 'Canvas digest required. Fetch GET /api/canvas/visual first.',
            hint: 'Every pixel placement requires a recent canvas digest to prove you viewed the canvas. Check the X-Canvas-Digest header.',
          },
          { status: 400 }
        );
      }

      const canvasValidation = validateCanvasDigest(canvas_digest);

      if (!canvasValidation.valid) {
        return jsonWithVersion(
          {
            error: canvasValidation.reason,
            hint: 'Your canvas digest is stale or invalid. Call GET /api/canvas/visual for a fresh one (check X-Canvas-Digest header).',
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

    // Build response with charge info if available
    const response: Record<string, unknown> = {
      success: true,
      pixel: update,
      message: `${agentId} placed a pixel at (${x}, ${y})`,
    };

    // Include charge info for registered agents
    if (remainingCharges !== null) {
      response.charges = remainingCharges;
      response.maxCharges = maxCharges;
      if (nextChargeAt) {
        response.nextChargeAt = nextChargeAt;
      }
    }

    return jsonWithVersion(response);

  } catch (error) {
    console.error('Pixel error:', error);
    return jsonWithVersion(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
