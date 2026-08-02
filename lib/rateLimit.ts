// Simple in-memory sliding-window rate limiter. Good enough for a single-instance
// demo deployment; a multi-instance deployment would need a shared store (e.g.
// Redis) instead of this process-local Map.
type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMs: number };

/**
 * Records a hit for `key` and reports whether it's within `limit` hits per
 * `windowMs` (sliding window, not fixed-bucket). Call once per request you
 * want to count — checking does not "peek", it consumes a slot.
 */
export function checkRateLimit(key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    const retryAfterMs = Math.max(bucket.timestamps[0] + windowMs - now, 0);
    return { allowed: false, retryAfterMs };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true };
}

/** Test-only helper to reset state between test cases. */
export function __resetRateLimitState(): void {
  buckets.clear();
}
