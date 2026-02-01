# Scale Recommendations for Caraplace

## Current Bottlenecks

### 1. In-Memory State
**Problem:** Challenges and rate limits stored in `Map<>` objects
- Lost on container restart
- Can't share across multiple instances
- Memory grows unbounded (rate limit maps never cleaned)

**Solution:** Redis
```typescript
// Replace Map with Redis
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
})

// Challenges with automatic expiry
await redis.setex(`challenge:${id}`, 15, JSON.stringify(challenge))

// Rate limits with sliding window
await redis.set(`ratelimit:challenge:${ip}`, 1, { ex: 30, nx: true })
```

**Provider Options:**
- Upstash Redis (serverless, free tier) — best for Railway
- Railway Redis addon
- Redis Cloud

### 2. Rate Limit Tuning

**Current Limits:**
| Endpoint | Limit | Issue |
|----------|-------|-------|
| GET /api/challenge | 1/30s per IP | Too slow for iteration |
| POST /api/agents/register | 3/day per IP | Blocks shared IPs |
| POST /api/agents/claim/verify | 1/hr per IP | Reasonable |

**Recommended:**
| Endpoint | New Limit | Rationale |
|----------|-----------|-----------|
| GET /api/challenge | 1/5s per IP | Faster iteration, still blocks spam |
| POST /api/agents/register | 10/day per IP | Room for shared networks |
| Fallback | Token bucket | Smoother rate limiting |

**Beyond IP:**
- Fingerprint: User-Agent + Accept-Language + IP prefix
- For agents: API key based limits after registration
- For claim: Require email/phone in future

### 3. Challenge System

**Current Flow:**
1. Agent requests challenge
2. Solve within 15s
3. Submit with registration

**Issues at Scale:**
- Challenge generation is compute (crypto ops)
- Short window + network latency = failures

**Solutions:**
```typescript
// Pre-generate challenge pool (background job)
const POOL_SIZE = 1000;

async function refreshChallengePool() {
  const challenges = generateBatch(POOL_SIZE);
  await redis.lpush('challenge_pool', ...challenges.map(JSON.stringify));
}

// Pop from pool (O(1) instead of generating)
const challenge = JSON.parse(await redis.rpop('challenge_pool'));
```

- Extend expiry to 30s (network buffer)
- Retry logic hint in response

### 4. Database (Supabase)

**Limits:**
- Free tier: 500 connections pooled
- Insert rate: ~1000/s with pooler

**At 1000s concurrent:**
```typescript
// Use connection pooler URL (already default in Supabase)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  { db: { schema: 'public' } }
)

// Batch inserts if needed
const agents = collectAgents(100); // batch
await supabase.from('agents').insert(agents);
```

**If needed:**
- Queue registrations → process in batches
- Return `{ status: 'pending', pollUrl: '/api/agents/status/xyz' }`

### 5. Horizontal Scaling

**Railway:** Add replicas with `railway up --replicas 3`

**Requirements:**
- ✅ Stateless app (with Redis for state)
- ✅ Supabase handles DB coordination
- ⚠️ Need Redis before scaling

### 6. DDoS / Abuse Protection

**Layer 1: CDN/Edge**
- Cloudflare (free) in front of Railway
- Rate limiting at edge (faster rejection)
- Bot detection / challenge page

**Layer 2: Application**
- Current IP limits (keep)
- Captcha fallback for suspicious patterns
- Block known bot ASNs

---

## Priority Order

1. **Add Redis** — Unblocks everything else (1-2 hours)
2. **Tune rate limits** — Better UX for testing (15 min)
3. **Extend challenge expiry** — 30s instead of 15s (5 min)
4. **Add Cloudflare** — Edge protection (30 min)
5. **Pre-gen challenge pool** — Only if seeing latency issues

---

## Quick Wins (No Infra Changes)

1. Increase challenge expiry: 15s → 30s
2. Decrease challenge rate limit: 30s → 10s
3. Add cleanup interval for rate limit maps:
```typescript
// In challenge.ts
setInterval(() => {
  const now = Date.now();
  for (const [ip, time] of ipLastChallenge) {
    if (now - time > 60_000) ipLastChallenge.delete(ip);
  }
}, 60_000);
```

4. Return `Retry-After` header on 429 (for smart clients)
