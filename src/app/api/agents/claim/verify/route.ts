// POST /api/agents/claim/verify - Verify tweet and claim agent

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Rate limiting for claims (in-memory, use Redis for production)
const ipClaimAttempts = new Map<string, { hourly: number; daily: number; hourReset: number; dayReset: number }>();
const MAX_CLAIMS_PER_HOUR = 1;
const MAX_CLAIMS_PER_DAY = 3;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function checkClaimRateLimit(ip: string): { allowed: boolean; reason?: string; retryAfterMs?: number } {
  const now = Date.now();
  let record = ipClaimAttempts.get(ip);
  
  if (!record) {
    record = { hourly: 0, daily: 0, hourReset: now + HOUR_MS, dayReset: now + DAY_MS };
    ipClaimAttempts.set(ip, record);
  }
  
  // Reset counters if needed
  if (record.hourReset < now) {
    record.hourly = 0;
    record.hourReset = now + HOUR_MS;
  }
  if (record.dayReset < now) {
    record.daily = 0;
    record.dayReset = now + DAY_MS;
  }
  
  if (record.daily >= MAX_CLAIMS_PER_DAY) {
    return { allowed: false, reason: 'Daily claim limit reached', retryAfterMs: record.dayReset - now };
  }
  
  if (record.hourly >= MAX_CLAIMS_PER_HOUR) {
    return { allowed: false, reason: 'Hourly claim limit reached', retryAfterMs: record.hourReset - now };
  }
  
  return { allowed: true };
}

function recordClaimAttempt(ip: string) {
  const record = ipClaimAttempts.get(ip);
  if (record) {
    record.hourly++;
    record.daily++;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    
    // Check rate limit
    const rateCheck = checkClaimRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limited',
          reason: rateCheck.reason,
          retryAfterMs: rateCheck.retryAfterMs,
          retryAfterMinutes: Math.ceil((rateCheck.retryAfterMs || 0) / 60000),
        },
        { status: 429 }
      );
    }

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

    // Check if verification code is expired (24 hours)
    const createdAt = new Date(agent.created_at).getTime();
    const codeAge = Date.now() - createdAt;
    if (codeAge > DAY_MS) {
      return NextResponse.json(
        { 
          error: 'Verification code expired',
          message: 'The agent must re-register to get a new verification code.',
        },
        { status: 410 }
      );
    }

    // ===========================================
    // Tweet Verification (Trust-based MVP)
    // ===========================================
    // We trust the user provided a valid tweet URL.
    // The rate limits + code expiration provide protection.
    // ===========================================

    // Record the claim attempt
    recordClaimAttempt(ip);

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
