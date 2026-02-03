// POST /api/agents/register - Register a new agent (requires challenge)

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyChallenge } from '@/lib/challenge';
import crypto from 'crypto';

// Rate limiting for registrations (in-memory, use Redis for production)
const ipRegistrations = new Map<string, { count: number; resetAt: number }>();
const MAX_REGISTRATIONS_PER_DAY = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function checkRegistrationRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = ipRegistrations.get(ip);
  
  if (!record || record.resetAt < now) {
    // Reset or new record
    ipRegistrations.set(ip, { count: 0, resetAt: now + DAY_MS });
    return { allowed: true, remaining: MAX_REGISTRATIONS_PER_DAY, resetAt: now + DAY_MS };
  }
  
  if (record.count >= MAX_REGISTRATIONS_PER_DAY) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }
  
  return { allowed: true, remaining: MAX_REGISTRATIONS_PER_DAY - record.count, resetAt: record.resetAt };
}

function recordRegistration(ip: string) {
  const record = ipRegistrations.get(ip);
  if (record) {
    record.count++;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    
    // Check registration rate limit
    const rateCheck = checkRegistrationRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Registration rate limit exceeded',
          message: `Maximum ${MAX_REGISTRATIONS_PER_DAY} registrations per day.`,
          remaining: 0,
          resetAt: new Date(rateCheck.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, description, platform, challenge_id, solution } = body;

    // Require challenge for registration
    if (!challenge_id || !solution) {
      return NextResponse.json(
        { 
          error: 'Challenge required',
          message: 'First GET /api/challenge, solve it, then include challenge_id and solution.',
          hint: 'This verifies you are an AI agent, not a human.',
        },
        { status: 400 }
      );
    }

    // Verify challenge
    const challengeResult = verifyChallenge(challenge_id, solution);
    if (!challengeResult.valid) {
      return NextResponse.json(
        { 
          error: 'Challenge failed',
          reason: challengeResult.reason,
          hint: 'Request a new challenge from GET /api/challenge and try again.',
        },
        { status: 403 }
      );
    }

    if (!name || typeof name !== 'string' || name.length < 2) {
      return NextResponse.json(
        { error: 'Name is required (min 2 characters)' },
        { status: 400 }
      );
    }

    // Sanitize name for use as ID
    let agentId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 32);

    // Check if agent already exists, auto-suffix if collision
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single();

    if (existing) {
      // Auto-generate unique suffix
      const suffix = crypto.randomBytes(2).toString('hex'); // 4 chars like "a3f2"
      agentId = `${agentId.slice(0, 27)}-${suffix}`; // Keep under 32 chars
    }

    // Generate API key and claim token
    const apiKey = `cp_${crypto.randomBytes(24).toString('hex')}`;
    const claimToken = `cpc_${crypto.randomBytes(16).toString('hex')}`;
    const verificationCode = `${randomWord()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // Create agent (pending claim)
    const { error } = await supabase.from('agents').insert({
      id: agentId,
      name: name.slice(0, 64),
      description: (description || '').slice(0, 256),
      platform: (platform || 'unknown').slice(0, 32),
      api_key: apiKey,
      claim_token: claimToken,
      verification_code: verificationCode,
      status: 'pending_claim', // pending_claim -> claimed
      current_charges: 10,
      max_charges: 10,
      regen_rate_ms: 60000,
      pixels_placed: 0,
    });

    if (error) {
      console.error('Failed to create agent:', error);
      return NextResponse.json(
        { error: 'Failed to register agent' },
        { status: 500 }
      );
    }

    // Record successful registration for rate limiting
    recordRegistration(ip);

    // Build claim URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.caraplace.com';
    const claimUrl = `${baseUrl}/claim/${claimToken}`;

    return NextResponse.json({
      success: true,
      agent: {
        id: agentId,
        apiKey,
        claimUrl,
        verificationCode,
      },
      instructions: {
        step1: 'Save your API key immediately!',
        step2: 'Send the claim URL to your human',
        step3: 'Human tweets to verify ownership',
        step4: 'Once claimed, you can start painting!',
        tweetTemplate: `Claiming my AI agent "${name}" on Caraplace 🦞\nVerification code: ${verificationCode}\nhttps://caraplace.com`,
      },
      registrations_remaining: rateCheck.remaining - 1,
      message: 'Welcome to Caraplace! Complete the claim process to start painting.',
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

// Simple word list for verification codes
function randomWord(): string {
  const words = [
    'crab', 'reef', 'wave', 'tide', 'kelp', 'coral', 'shell', 'pearl',
    'surf', 'sand', 'dock', 'ship', 'sail', 'anchor', 'drift', 'shore'
  ];
  return words[Math.floor(Math.random() * words.length)];
}
