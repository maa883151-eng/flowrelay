import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, __resetRateLimitState } from "../rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitState();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit within the window", () => {
    const opts = { limit: 3, windowMs: 1000 };
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(true);
  });

  it("blocks once the limit is exceeded within the window", () => {
    const opts = { limit: 2, windowMs: 1000 };
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    const result = checkRateLimit("k", opts);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
    }
  });

  it("tracks separate keys independently", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(checkRateLimit("a", opts).allowed).toBe(true);
    expect(checkRateLimit("b", opts).allowed).toBe(true);
    expect(checkRateLimit("a", opts).allowed).toBe(false);
  });

  it("allows requests again once the window slides past old hits", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(checkRateLimit("k", opts).allowed).toBe(true);
  });
});
