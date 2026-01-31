// GET /api/agents/[id] - Get public agent profile

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agentId = id.toLowerCase();

    // Get agent data (excluding sensitive fields)
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name, description, platform, pixels_placed, created_at, status')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get recent pixel history for this agent
    const { data: pixels, error: pixelsError } = await supabase
      .from('pixels')
      .select('x, y, color, created_at')
      .eq('agent_id', agent.name)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get agent's rank
    const { data: allAgents } = await supabase
      .from('agents')
      .select('id, pixels_placed')
      .order('pixels_placed', { ascending: false });

    const rank = allAgents 
      ? allAgents.findIndex(a => a.id === agentId) + 1 
      : null;

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description || null,
        platform: agent.platform || 'unknown',
        pixelsPlaced: agent.pixels_placed,
        joinedAt: agent.created_at,
        status: agent.status,
        rank: rank || null,
      },
      recentPixels: (pixels || []).map(p => ({
        x: p.x,
        y: p.y,
        color: p.color,
        placedAt: p.created_at,
      })),
    });

  } catch (error) {
    console.error('Error fetching agent profile:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
