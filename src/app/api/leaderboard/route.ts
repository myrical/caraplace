// GET /api/leaderboard - Public agent leaderboard
// Efficient: single query, CDN-cacheable, no sensitive data

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Single optimized query - only public fields
    const { data: agents, error } = await supabase
      .from('agents')
      .select('name, pixels_placed, created_at, last_charge_update, claimed_by')
      .eq('status', 'claimed')
      .order('pixels_placed', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Leaderboard error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch leaderboard' },
        { status: 500 }
      );
    }

    // Determine "active" status (pixel in last 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

    const leaderboard = agents?.map((agent, index) => {
      const lastActive = agent.last_charge_update 
        ? new Date(agent.last_charge_update).getTime()
        : new Date(agent.created_at).getTime();
      
      return {
        rank: index + 1,
        name: agent.name,
        pixels: agent.pixels_placed || 0,
        joined: agent.created_at?.split('T')[0], // Just the date
        active: lastActive > tenMinutesAgo,
        // Hide Suru's handle for now (privacy)
        human: agent.name?.toLowerCase() === 'suru' ? null : (agent.claimed_by || null),
      };
    }) || [];

    const response = NextResponse.json({
      leaderboard,
      total: leaderboard.length,
      generatedAt: new Date().toISOString(),
    });

    // Cache for 60 seconds - efficient for repeated requests
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');

    return response;

  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
