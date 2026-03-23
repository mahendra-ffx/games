/**
 * Application-layer rate limiting
 *
 * Works alongside Cloudflare edge rate limiting rules.
 * Uses Cloudflare KV for distributed per-user request counting.
 *
 * Limits (from CLAUDE.md §12):
 * - /api/validate: 30 req/min (auth), 15 req/min (anon)
 * - /api/score: 10 req/min (auth), 5 req/min (anon)
 * - Hint redemption: 5 req/min (auth), 3 req/min (anon)
 */

import type { NextRequest } from "next/server";

interface RateLimitConfig {
  windowMs: number;
  maxAuthenticated: number;
  maxAnonymous: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  validate: { windowMs: 60_000, maxAuthenticated: 30, maxAnonymous: 15 },
  score: { windowMs: 60_000, maxAuthenticated: 10, maxAnonymous: 5 },
  hints: { windowMs: 60_000, maxAuthenticated: 5, maxAnonymous: 3 },
};

/**
 * Extract a stable identifier from the request.
 * Prefer Piano UID from cookie, fall back to IP.
 */
function getIdentifier(req: NextRequest): {
  id: string;
  isAuthenticated: boolean;
} {
  const pianoSession = req.cookies.get("__ppid")?.value;
  if (pianoSession) {
    return { id: `user:${pianoSession}`, isAuthenticated: true };
  }

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown";

  return { id: `ip:${ip}`, isAuthenticated: false };
}

/**
 * In-process rate limiter (fallback when Cloudflare KV is unavailable).
 * Uses a sliding window per identifier.
 */
const memoryStore = new Map<string, { count: number; windowStart: number }>();

function checkMemoryLimit(
  key: string,
  config: RateLimitConfig,
  maxRequests: number
): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || now - existing.windowStart > config.windowMs) {
    memoryStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.windowStart + config.windowMs,
    };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetAt: existing.windowStart + config.windowMs,
  };
}

/**
 * Check rate limit for a given endpoint.
 * Returns RateLimitResult — caller is responsible for returning 429 if !allowed.
 */
export async function checkRateLimit(
  req: NextRequest,
  endpoint: keyof typeof ENDPOINT_LIMITS
): Promise<RateLimitResult> {
  const config = ENDPOINT_LIMITS[endpoint];
  if (!config) {
    return { allowed: true, remaining: 999, resetAt: Date.now() + 60_000 };
  }

  const { id, isAuthenticated } = getIdentifier(req);
  const maxRequests = isAuthenticated
    ? config.maxAuthenticated
    : config.maxAnonymous;
  const key = `ratelimit:${endpoint}:${id}`;

  // TODO: Replace with Cloudflare KV for distributed rate limiting at scale
  // const kvResult = await checkCloudflareKV(key, config, maxRequests);
  return checkMemoryLimit(key, config, maxRequests);
}

/**
 * Build a 429 response with standard headers.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(result.resetAt),
    },
  });
}
