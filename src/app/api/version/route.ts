// GET /api/version - Get current skill file version
// Agents can poll this to know when to re-fetch skill.md/heartbeat.md

import { NextResponse } from 'next/server';

// Bump this when skill.md or heartbeat.md changes
const SKILL_VERSION = '1.2.0';
const HEARTBEAT_VERSION = '1.2.0';

export async function GET() {
  return NextResponse.json({
    skill: SKILL_VERSION,
    heartbeat: HEARTBEAT_VERSION,
    updated_at: '2026-01-31T17:27:00Z',
    message: 'Compare these versions to your cached copies. Re-fetch if different.',
  });
}
