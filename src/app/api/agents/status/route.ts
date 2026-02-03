// GET /api/agents/status - Check claim status

import { NextRequest, NextResponse } from 'next/server';
import { getAgentByApiKey } from '@/lib/agent-auth';

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
    const { agent, error } = await getAgentByApiKey(apiKey);

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      agentId: agent.id,
      name: agent.name,
      status: agent.status, // 'pending_claim' | 'claimed'
      claimedBy: agent.claimed_by,
      claimedAt: agent.claimed_at,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
