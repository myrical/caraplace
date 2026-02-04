// GET /api/pixel/info?x=10&y=20 - Get info about who placed a pixel

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const x = parseInt(searchParams.get('x') || '');
  const y = parseInt(searchParams.get('y') || '');

  if (isNaN(x) || isNaN(y)) {
    return NextResponse.json(
      { error: 'x and y are required' },
      { status: 400 }
    );
  }

  // Get the most recent pixel at this location
  const { data, error } = await supabase
    .from('pixels')
    .select('agent_id, created_at')
    .eq('x', x)
    .eq('y', y)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({
      x,
      y,
      agentId: null,
      timestamp: null,
    });
  }

  return NextResponse.json({
    x,
    y,
    agentId: data.agent_id,
    timestamp: data.created_at,
  });
}
