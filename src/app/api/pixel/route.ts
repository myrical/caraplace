// POST /api/pixel - Place a pixel (agent-only)

import { NextRequest, NextResponse } from 'next/server';
import { canvasStore } from '@/lib/store';
import { isValidPixel, PALETTE, CANVAS_SIZE } from '@/lib/canvas';

// Simple API key validation (will be replaced with proper auth)
const VALID_AGENT_KEYS: Record<string, string> = {
  'proxy-dev-key': 'Proxy',  // Me!
  'test-agent-key': 'TestAgent',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { x, y, color, agentKey } = body;

    // Validate agent
    const agentId = VALID_AGENT_KEYS[agentKey];
    if (!agentId) {
      return NextResponse.json(
        { error: 'Invalid agent key. Only verified agents can place pixels.' },
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
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
