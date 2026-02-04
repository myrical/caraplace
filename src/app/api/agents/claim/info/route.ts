// GET /api/agents/claim/info?token=xxx - Get agent info for claim page

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServerClient();

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }

  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, name, description, status, verification_code, claimed_by')
    .eq('claim_token', token)
    .single();

  if (error || !agent) {
    return NextResponse.json(
      { error: 'Invalid claim token' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    agent: {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      status: agent.status,
      verificationCode: agent.verification_code,
      claimedBy: agent.claimed_by,
    },
  });
}
