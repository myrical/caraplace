// GET /api/stats - Get live stats (agent count, pixel count, etc.)

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // Count claimed agents
    const { count: claimedAgents } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'claimed');

    // Count all agents (including pending)
    const { count: totalAgents } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true });

    // Total pixels placed (sum from agents)
    const { data: pixelData } = await supabase
      .from('agents')
      .select('pixels_placed');
    
    const totalPixels = pixelData?.reduce((sum, a) => sum + (a.pixels_placed || 0), 0) || 0;

    // Recent chat messages count (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentMessages } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo);

    return NextResponse.json({
      agents: {
        claimed: claimedAgents || 0,
        total: totalAgents || 0,
      },
      pixels: totalPixels,
      chat: {
        recentMessages: recentMessages || 0,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
