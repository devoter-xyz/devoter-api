
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReplayProtectionCache } from '../src/lib/replayProtectionCache';

describe('ReplayProtectionCache', () => {
  let cache: ReplayProtectionCache;
  let mockNow: number;

  beforeEach(() => {
    mockNow = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(mockNow);
    cache = new ReplayProtectionCache(1000); // Cleanup every 1 second for testing
  });

  afterEach(() => {
    cache.stopCleanup();
    vi.useRealTimers();
  });

  it('should prevent signature reuse', () => {
    const key = 'test-signature';
    expect(cache.set(key, 10)).toBe(true); // First use
    expect(cache.set(key, 10)).toBe(false); // Reuse should fail
  });

  it('should allow signature reuse after TTL expiration', () => {
    const key = 'test-signature-ttl';
    cache.set(key, 1); // TTL of 1 second

    vi.advanceTimersByTime(1001); // Advance time past TTL

    expect(cache.has(key)).toBe(false); // Should be expired
    expect(cache.set(key, 10)).toBe(true); // Should be able to set again
  });

  it('should clean up expired entries', () => {
    const key1 = 'expired-key-1';
    const key2 = 'active-key-2';

    cache.set(key1, 1); // Expires in 1 second
    cache.set(key2, 10); // Expires in 10 seconds

    expect(cache.has(key1)).toBe(true);
    expect(cache.has(key2)).toBe(true);

    vi.advanceTimersByTime(1001); // Advance past key1's TTL
    vi.runOnlyPendingTimers(); // Trigger cleanup interval

    expect(cache.has(key1)).toBe(false); // Should be cleaned up
    expect(cache.has(key2)).toBe(true); // Should still be active
  });

  it('should handle concurrent access scenarios', () => {
    const key = 'concurrent-key';
    const results = Promise.all([
      Promise.resolve(cache.set(key, 5)),
      Promise.resolve(cache.set(key, 5)),
      Promise.resolve(cache.has(key)),
    ]);

    expect(results).resolves.toEqual([true, false, true]);
  });

  it('should handle rapid successive requests', () => {
    const key = 'rapid-key';
    expect(cache.set(key, 1)).toBe(true);
    expect(cache.has(key)).toBe(true);
    vi.advanceTimersByTime(500); // Halfway through TTL
    expect(cache.has(key)).toBe(true);
    expect(cache.set(key, 1)).toBe(false); // Still active
    vi.advanceTimersByTime(501); // Past TTL
    expect(cache.has(key)).toBe(false);
    expect(cache.set(key, 1)).toBe(true); // Can set again
  });

  it('should handle clock skew (setting time backwards)', () => {
    const key = 'clock-skew-key';
    cache.set(key, 10); // Set with 10s TTL

    vi.setSystemTime(mockNow - 5000); // Simulate clock going backwards by 5 seconds

    // Even with clock skew, the entry should still be considered active based on its original timestamp
    expect(cache.has(key)).toBe(true);

    vi.setSystemTime(mockNow + 10001); // Advance past original TTL
    expect(cache.has(key)).toBe(false);
  });

  describe('Performance Benchmarks', () => {
    const NUM_ENTRIES = 10000;
    const TTL_SECONDS = 60;

    it('should perform set operations efficiently', () => {
      const start = performance.now();
      for (let i = 0; i < NUM_ENTRIES; i++) {
        cache.set(`perf-key-${i}`, TTL_SECONDS);
      }
      const end = performance.now();
      const duration = end - start;
      console.log(`Set ${NUM_ENTRIES} entries: ${duration.toFixed(2)} ms`);
      expect(duration).toBeLessThan(500); // Arbitrary threshold, adjust as needed
    });

    it('should perform has operations efficiently for existing keys', () => {
      for (let i = 0; i < NUM_ENTRIES; i++) {
        cache.set(`perf-key-${i}`, TTL_SECONDS);
      }

      const start = performance.now();
      for (let i = 0; i < NUM_ENTRIES; i++) {
        cache.has(`perf-key-${i}`);
      }
      const end = performance.now();
      const duration = end - start;
      console.log(`Has ${NUM_ENTRIES} existing entries: ${duration.toFixed(2)} ms`);
      expect(duration).toBeLessThan(500); // Arbitrary threshold
    });

    it('should perform has operations efficiently for non-existing keys', () => {
      const start = performance.now();
      for (let i = 0; i < NUM_ENTRIES; i++) {
        cache.has(`non-existent-key-${i}`);
      }
      const end = performance.now();
      const duration = end - start;
      console.log(`Has ${NUM_ENTRIES} non-existing entries: ${duration.toFixed(2)} ms`);
      expect(duration).toBeLessThan(500); // Arbitrary threshold
    });

    it('should perform cleanup efficiently', () => {
      for (let i = 0; i < NUM_ENTRIES; i++) {
        cache.set(`cleanup-key-${i}`, 1); // All expire in 1 second
      }
      vi.advanceTimersByTime(1001); // Expire all entries

      const start = performance.now();
      vi.runOnlyPendingTimers(); // Trigger cleanup
      const end = performance.now();
      const duration = end - start;
      console.log(`Cleanup of ${NUM_ENTRIES} expired entries: ${duration.toFixed(2)} ms`);
      expect(duration).toBeLessThan(500); // Arbitrary threshold
    });
  });
});
