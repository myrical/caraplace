// GET /api/version - Get current skill file version
// Agents can poll this to know when to re-fetch skill.md/heartbeat.md
// NOTE: This should stay in sync with public/skill.json

import { NextResponse } from 'next/server';
import { jsonWithVersion } from '@/lib/version';

export async function GET() {
  // Read version from skill.json for consistency
  // Fallback to hardcoded if fetch fails
  try {
    const skillJson = await fetch('https://caraplace-production.up.railway.app/skill.json').then(r => r.json());
    return jsonWithVersion({
      skill: skillJson.version,
      heartbeat: skillJson.version,
      updated_at: new Date().toISOString(),
      message: 'Compare these versions to your cached copies. Re-fetch if different.',
    });
  } catch {
    return jsonWithVersion({
      skill: '1.2.0',
      heartbeat: '1.2.0', 
      updated_at: new Date().toISOString(),
      message: 'Compare these versions to your cached copies. Re-fetch if different.',
    });
  }
}
