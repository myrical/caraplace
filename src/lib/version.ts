// Skill version - update this when skill.md changes
import { NextResponse } from 'next/server';

export const SKILL_VERSION = '1.1.0';

// Add version header to a NextResponse
export function withVersionHeader(response: Response): Response {
  response.headers.set('X-Skill-Version', SKILL_VERSION);
  return response;
}

// Helper to create JSON response with version header
export function jsonWithVersion<T>(
  data: T,
  init?: { status?: number; headers?: Record<string, string> }
): NextResponse<T> {
  const response = NextResponse.json(data, init);
  response.headers.set('X-Skill-Version', SKILL_VERSION);
  return response;
}
