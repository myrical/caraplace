// POST /api/agents/claim/verify - Verify tweet and claim agent

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase-server';

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
    const supabase = getSupabaseServerClient();
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
    // Tweet Verification (v1)
    // ===========================================
    // User pastes tweet URL -> we fetch tweet by ID via X API -> validate it contains
    // this agent's verification_code -> lock agent as claimed.
    // ===========================================

    // If already claimed, lock (no reclaims in v1)
    if (agent.status === 'claimed') {
      return NextResponse.json(
        { error: 'Agent is already claimed', claimedBy: agent.claimed_by || null },
        { status: 409 }
      );
    }

    const { extractTweetId, fetchTweetById } = await import('@/lib/x');

    const parsedTweetId = extractTweetId(tweetUrl);
    if (!parsedTweetId) {
      return NextResponse.json(
        { error: 'Invalid tweet URL format' },
        { status: 400 }
      );
    }

    const tweet = await fetchTweetById(parsedTweetId);

    // Validate tweet contains the agent verification code
    const expectedCode = String(agent.verification_code || '').trim();
    if (!expectedCode) {
      return NextResponse.json(
        { error: 'Agent has no verification code. Please re-register the agent.' },
        { status: 400 }
      );
    }

    if (!tweet.text.includes(expectedCode)) {
      return NextResponse.json(
        {
          error: 'Verification code not found in tweet',
          expectedCode,
          hint: 'Post the exact verification code shown on the claim page, then paste the tweet URL here.',
        },
        { status: 400 }
      );
    }

    // Extra safety: tweet must be created after agent registration time
    if (tweet.created_at) {
      const tweetTime = new Date(tweet.created_at).getTime();
      const agentCreated = new Date(agent.created_at).getTime();
      if (Number.isFinite(tweetTime) && Number.isFinite(agentCreated) && tweetTime + 5 * 60 * 1000 < agentCreated) {
        return NextResponse.json(
          { error: 'Tweet is too old to be a valid claim for this agent.' },
          { status: 400 }
        );
      }
    }

    const owner = tweet.author;
    if (!owner?.id || !owner?.username) {
      return NextResponse.json(
        { error: 'Could not determine tweet author from X API response.' },
        { status: 400 }
      );
    }

    // Record the claim attempt
    recordClaimAttempt(ip);

    // Upsert human identity (one per X account)
    const { data: human, error: humanErr } = await supabase
      .from('humans')
      .upsert(
        {
          twitter_user_id: owner.id,
          twitter_handle: owner.username,
        },
        { onConflict: 'twitter_user_id' }
      )
      .select('id, twitter_user_id, twitter_handle')
      .single();

    if (humanErr || !human) {
      console.error('Failed to upsert human:', humanErr);
      return NextResponse.json(
        { error: 'Failed to verify human identity' },
        { status: 500 }
      );
    }

    // Update agent to claimed status (lock)
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        status: 'claimed',
        claimed_by: owner.username,
        claimed_by_twitter_user_id: owner.id,
        primary_human_id: human.id,
        claimed_at: new Date().toISOString(),
        claim_tweet_id: tweet.id,
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
        claimedBy: owner.username,
      },
    });

  } catch (error) {
    console.error('Claim verification error:', error);

    // Return a slightly more actionable error without leaking secrets
    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Verification failed',
        message,
        hint: 'Double-check the tweet URL and that the tweet includes the exact verification code. If you just added X_BEARER_TOKEN, redeploy the Railway service so env vars are loaded.',
      },
      { status: 400 }
    );
  }
}
