/**
 * Simple in-memory rate limiter for AI chat API.
 *
 * Limits: 20 requests per hour per IP address.
 *
 * Note: This is per-serverless-instance on Vercel, so it won't catch
 * abuse perfectly across cold starts. But it handles the most common
 * case (rapid-fire requests from a single user) and costs nothing.
 */

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS = 20

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export function checkRateLimit(identifier: string): {
  allowed: boolean
  remaining: number
  resetInSeconds: number
} {
  const now = Date.now()
  const entry = store.get(identifier)

  // First request or window expired
  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetInSeconds: Math.ceil(WINDOW_MS / 1000) }
  }

  // Within window
  if (entry.count < MAX_REQUESTS) {
    entry.count++
    return {
      allowed: true,
      remaining: MAX_REQUESTS - entry.count,
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
