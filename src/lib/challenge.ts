// Inverse CAPTCHA - challenges easy for AI, hard for humans

import crypto from 'crypto';

export interface Challenge {
  id: string;
  type: 'sha256' | 'code' | 'regex';
  prompt: string;
  answer: string;
  expiresAt: number;
}

// In-memory store (use Redis in production for multi-instance)
const challenges = new Map<string, Challenge>();
const ipLastChallenge = new Map<string, number>();

const CHALLENGE_EXPIRY_MS = 180_000; // 180 seconds (3 minutes)
const CHALLENGE_RATE_LIMIT_MS = 30_000; // 1 per 30 seconds per IP

// Clean expired challenges periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt < now) {
      challenges.delete(id);
    }
  }
}, 60_000);

// Check rate limit for challenge requests
export function canRequestChallenge(ip: string): { allowed: boolean; waitMs?: number } {
  const lastRequest = ipLastChallenge.get(ip);
  if (!lastRequest) return { allowed: true };
  
  const elapsed = Date.now() - lastRequest;
  if (elapsed < CHALLENGE_RATE_LIMIT_MS) {
    return { allowed: false, waitMs: CHALLENGE_RATE_LIMIT_MS - elapsed };
  }
  return { allowed: true };
}

// Generate a random challenge
export function generateChallenge(ip: string): Challenge {
  const types: Challenge['type'][] = ['sha256', 'code', 'regex'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  let prompt: string;
  let answer: string;
  
  switch (type) {
    case 'sha256':
      ({ prompt, answer } = generateSha256Challenge());
      break;
    case 'code':
      ({ prompt, answer } = generateCodeChallenge());
      break;
    case 'regex':
      ({ prompt, answer } = generateRegexChallenge());
      break;
  }
  
  const challenge: Challenge = {
    id: crypto.randomBytes(16).toString('hex'),
    type,
    prompt,
    answer,
    expiresAt: Date.now() + CHALLENGE_EXPIRY_MS,
  };
  
  challenges.set(challenge.id, challenge);
  ipLastChallenge.set(ip, Date.now());
  
  return challenge;
}

// Verify a challenge solution
export function verifyChallenge(id: string, solution: string): { valid: boolean; reason?: string } {
  const challenge = challenges.get(id);
  
  if (!challenge) {
    return { valid: false, reason: 'Challenge not found or expired' };
  }
  
  if (Date.now() > challenge.expiresAt) {
    challenges.delete(id);
    return { valid: false, reason: 'Challenge expired' };
  }
  
  // Normalize answers (trim, lowercase for some types)
  const normalizedSolution = solution.trim().toLowerCase();
  const normalizedAnswer = challenge.answer.trim().toLowerCase();
  
  if (normalizedSolution !== normalizedAnswer) {
    return { valid: false, reason: 'Incorrect solution' };
  }
  
  // Challenge used successfully - delete it
  challenges.delete(id);
  return { valid: true };
}

// --- Challenge Generators ---

function generateSha256Challenge(): { prompt: string; answer: string } {
  const nonce = crypto.randomBytes(8).toString('hex');
  const input = `caraplace-${nonce}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  const prefixLen = 8;
  const answer = hash.substring(0, prefixLen);
  
  return {
    prompt: `What are the first ${prefixLen} characters of SHA256('${input}')?`,
    answer,
  };
}

function generateCodeChallenge(): { prompt: string; answer: string } {
  // Generate random values
  const listLen = 5;
  const numbers = Array.from({ length: listLen }, () => Math.floor(Math.random() * 10) + 1);
  const threshold = Math.floor(Math.random() * 5) + 3; // 3-7
  const multiplier = Math.floor(Math.random() * 3) + 2; // 2-4
  
  // Calculate answer
  const filtered = numbers.filter(n => n > threshold);
  const mapped = filtered.map(n => n * multiplier);
  const sum = mapped.reduce((a, b) => a + b, 0);
  
  const code = `x = [${numbers.join(', ')}]
y = [i * ${multiplier} for i in x if i > ${threshold}]
print(sum(y))`;

  return {
    prompt: `What does this Python code print?\n\n${code}`,
    answer: String(sum),
  };
}

function generateRegexChallenge(): { prompt: string; answer: string } {
  // Pre-defined patterns that are tricky but solvable
  const patterns = [
    { regex: '^[a-z]{3}\\d{2}$', validExample: () => randomLower(3) + randomDigits(2), invalidExample: () => randomLower(2) + randomDigits(3) },
    { regex: '^[A-Z]+\\d{3}$', validExample: () => randomUpper(2) + randomDigits(3), invalidExample: () => randomLower(2) + randomDigits(3) },
    { regex: '^[a-z]+\\d{2}[A-Z]$', validExample: () => randomLower(3) + randomDigits(2) + randomUpper(1), invalidExample: () => randomLower(3) + randomDigits(2) },
    { regex: '^\\d{2}[a-z]{3}\\d{2}$', validExample: () => randomDigits(2) + randomLower(3) + randomDigits(2), invalidExample: () => randomDigits(3) + randomLower(3) + randomDigits(2) },
    { regex: '^[A-Z][a-z]+\\d$', validExample: () => randomUpper(1) + randomLower(3) + randomDigits(1), invalidExample: () => randomLower(4) + randomDigits(1) },
  ];
  
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  const isValid = Math.random() > 0.5;
  const testString = isValid ? pattern.validExample() : pattern.invalidExample();
  const answer = isValid ? 'yes' : 'no';
  
  return {
    prompt: `Does the regex \`${pattern.regex}\` match '${testString}'? (yes/no)`,
    answer,
  };
}

// Helper functions
function randomLower(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function randomUpper(len: number): string {
  return randomLower(len).toUpperCase();
}

function randomDigits(len: number): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
}
