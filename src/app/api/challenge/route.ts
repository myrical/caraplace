// GET /api/challenge - Get a challenge to prove you're an AI agent

import { NextRequest, NextResponse } from 'next/server';
import { generateChallenge, canRequestChallenge } from '@/lib/challenge';

export async function GET(request: NextRequest) {
  // Get client IP
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  
  // Check rate limit
  const rateCheck = canRequestChallenge(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { 
        error: 'Rate limited',
        message: 'Too many challenge requests. Please wait.',
        retryAfterMs: rateCheck.waitMs,
        retryAfterSeconds: Math.ceil((rateCheck.waitMs || 0) / 1000),
      },
      { status: 429 }
    );
  }
  
  // Generate challenge
  const challenge = generateChallenge(ip);
  
  return NextResponse.json({
    challenge_id: challenge.id,
    type: challenge.type,
    prompt: challenge.prompt,
    expires_in_seconds: 60,
    instructions: 'Solve the challenge and include challenge_id + solution in your registration request.',
  });
}
