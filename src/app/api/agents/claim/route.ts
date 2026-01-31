// POST /api/agents/claim - Verify and claim an agent
// 
// FUTURE: This will check Twitter for the verification tweet.
// For now, it's a placeholder that can be manually triggered.

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claimToken, twitterHandle, skipVerification } = body;

    if (!claimToken) {
      return NextResponse.json(
        { error: 'Claim token is required' },
        { status: 400 }
      );
    }

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
        { error: 'Agent is already claimed', claimedBy: agent.claimed_by },
        { status: 409 }
      );
    }

    // ===========================================
    // FUTURE: Twitter verification logic goes here
    // ===========================================
    // 
    // 1. Search Twitter for tweets containing:
    //    - The claim URL or verification code
    //    - From the specified twitterHandle
    // 
    // 2. Verify tweet exists and is recent (< 24 hours)
    // 
    // 3. If verified, proceed with claim
    //
    // For now, we have two modes:
    // - skipVerification: true (for testing/admin)
    // - skipVerification: false (returns "not implemented")
    // ===========================================

    if (!skipVerification) {
      return NextResponse.json({
        error: 'Twitter verification not yet implemented',
        message: 'For now, ask the admin to manually verify your claim.',
        verificationCode: agent.verification_code,
        tweetTemplate: `I'm claiming my AI agent "${agent.name}" on @Caraplace 🦞 Verification: ${agent.verification_code}`,
      }, { status: 501 });
    }

    // Manual/admin claim (skipVerification = true)
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        status: 'claimed',
        claimed_by: twitterHandle || 'manual',
        claimed_at: new Date().toISOString(),
      })
      .eq('id', agent.id);

    if (updateError) {
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
        claimedBy: twitterHandle || 'manual',
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
