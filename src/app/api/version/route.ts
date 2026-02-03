// GET /api/version - Get current skill file version
// Agents can poll this to know when to re-fetch skill.md/heartbeat.md
// NOTE: This should stay in sync with public/skill.json

import { jsonWithVersion } from '@/lib/version';
import { getPublicBaseUrl } from '@/lib/url';

export async function GET(request: Request) {
  // Read version from skill.json for consistency
  // Fallback to hardcoded if fetch fails
  try {
    const baseUrl = getPublicBaseUrl(request);
    const skillJson = await fetch(`${baseUrl}/skill.json`).then(r => r.json());
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
