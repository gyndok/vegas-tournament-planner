/**
 * In-memory token-bucket rate limiter. Keyed by an arbitrary string
 * (typically `${ip}:${route}` or `${userId}:${route}`). Single-region; not
 * shared across instances. Good enough for v1 pool routes.
 */

interface Bucket {
  count: number
  resetAt: number
}

const BUCKETS = new Map<string, Bucket>()
const MAX_BUCKETS = 10000

export function checkRateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  const existing = BUCKETS.get(key)
  if (!existing || existing.resetAt <= now) {
    // Trim oldest if cache too large.
    if (BUCKETS.size >= MAX_BUCKETS) {
      const oldestKey = BUCKETS.keys().next().value
      if (oldestKey !== undefined) BUCKETS.delete(oldestKey)
    }
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterMs: 0 }
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterMs: existing.resetAt - now }
  }
  existing.count += 1
  return { ok: true, retryAfterMs: 0 }
}

/**
 * Legacy chat-specific rate limiter (20 req/hour per IP).
 * Used by /api/chat. Kept separate from the generic token-bucket above
 * so the chat route's existing response shape doesn't change.
 */

const CHAT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const CHAT_MAX_REQUESTS = 20

interface ChatRateLimitEntry {
  count: number
  resetAt: number
}

const chatStore = new Map<string, ChatRateLimitEntry>()

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of chatStore) {
    if (now > entry.resetAt) {
      chatStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export function checkChatRateLimit(identifier: string): {
  allowed: boolean
  remaining: number
  resetInSeconds: number
} {
  const now = Date.now()
  const entry = chatStore.get(identifier)

  // First request or window expired
  if (!entry || now > entry.resetAt) {
    chatStore.set(identifier, { count: 1, resetAt: now + CHAT_WINDOW_MS })
    return { allowed: true, remaining: CHAT_MAX_REQUESTS - 1, resetInSeconds: Math.ceil(CHAT_WINDOW_MS / 1000) }
  }

  // Within window
  if (entry.count < CHAT_MAX_REQUESTS) {
    entry.count++
    return {
      allowed: true,
      remaining: CHAT_MAX_REQUESTS - entry.count,
      resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  // Rate limited
  return {
    allowed: false,
    remaining: 0,
    resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
  }
}
