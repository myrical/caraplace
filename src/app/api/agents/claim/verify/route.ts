// POST /api/agents/claim/verify - Verify tweet and claim agent

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claimToken, tweetUrl } = body;

    if (!claimToken || !tweetUrl) {
      return NextResponse.json(
        { error: 'Claim token and tweet URL are required' },
        { status: 400 }
      );
    }

    // Validate tweet URL format
    const tweetUrlPattern = /^https?:\/\/(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/;
    const match = tweetUrl.match(tweetUrlPattern);
    
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid tweet URL format' },
        { status: 400 }
      );
    }

    const twitterHandle = match[2];
    const tweetId = match[3];

    // Look up agent by claim token
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('claim_token', claimToken)
      .single();

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Invalid claim token' },
        { status: 404 }
      );
    }

    if (agent.status === 'claimed') {
      return NextResponse.json(
        { error: 'Agent is already claimed' },
        { status: 409 }
      );
    }

    // ===========================================
    // Tweet Verification
    // ===========================================
    // For MVP: We trust the user provided a valid tweet URL
    // containing the verification code. In production, we'd:
    // 1. Use Twitter API to fetch the tweet
    // 2. Verify it contains the verification code
    // 3. Verify the tweet is recent (< 24 hours)
    //
    // For now, we just check the URL format is valid
    // and record the Twitter handle + tweet ID
    // ===========================================

    // Update agent to claimed status
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        status: 'claimed',
        claimed_by: twitterHandle,
        claimed_at: new Date().toISOString(),
        claim_tweet_id: tweetId,
        claim_tweet_url: tweetUrl,
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('Failed to claim agent:', updateError);
      return NextResponse.json(
        { error: 'Failed to claim agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Agent "${agent.name}" has been claimed!`,
      agent: {
        id: agent.id,
        name: agent.name,
        status: 'claimed',
        claimedBy: twitterHandle,
      },
    });

  } catch (error) {
    console.error('Claim verification error:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
