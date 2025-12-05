import {
  recordRateLimitEvent,
  getRateLimitAnalytics,
  clearRateLimitAnalytics,
  RateLimitEvent,
} from '../src/lib/rateLimitAnalytics';
import { beforeEach, describe, expect, test } from 'vitest';

describe('rateLimitAnalytics', () => {
  beforeEach(() => {
    clearRateLimitAnalytics();
  });

  test('should record total and limited events correctly', () => {
    recordRateLimitEvent({ endpoint: '/test', key: 'user1', limitType: 'general', isLimited: false });
    recordRateLimitEvent({ endpoint: '/test', key: 'user2', limitType: 'general', isLimited: true });
    recordRateLimitEvent({ endpoint: '/test2', key: 'user3', limitType: 'auth', isLimited: true });

    const analytics = getRateLimitAnalytics();
    expect(analytics.totalEvents).toBe(3);
    expect(analytics.limitedEvents).toBe(2);
    expect(analytics.limitedPercentage).toBeCloseTo((2 / 3) * 100);
  });

  test('should aggregate hits by endpoint and limit type correctly', () => {
    recordRateLimitEvent({ endpoint: '/test', key: 'user1', limitType: 'general', isLimited: true });
    recordRateLimitEvent({ endpoint: '/test', key: 'user2', limitType: 'general', isLimited: true });
    recordRateLimitEvent({ endpoint: '/test2', key: 'user3', limitType: 'auth', isLimited: true });
    recordRateLimitEvent({ endpoint: '/test', key: 'user4', limitType: 'general', isLimited: false }); // Not limited

    const analytics = getRateLimitAnalytics();
    expect(analytics.hitsByEndpoint).toEqual({
      '/test': 2,
      '/test2': 1,
    });
    expect(analytics.hitsByLimitType).toEqual({
      'general': 2,
      'auth': 1,
    });
  });

  test('should identify top violators correctly', () => {
    recordRateLimitEvent({ endpoint: '/test', key: 'user1', limitType: 'general', isLimited: true });
    recordRateLimitEvent({ endpoint: '/test', key: 'user1', limitType: 'general', isLimited: true });
    recordRateLimitEvent({ endpoint: '/test', key: 'user2', limitType: 'general', isLimited: true });
    recordRateLimitEvent({ endpoint: '/test', key: 'user3', limitType: 'general', isLimited: true });
    recordRateLimitEvent({ endpoint: '/test', key: 'user1', limitType: 'general', isLimited: false }); // Not limited

    const analytics = getRateLimitAnalytics();
    expect(analytics.topViolators).toEqual([
      { key: 'user1', count: 2 },
      { key: 'user2', count: 1 },
      { key: 'user3', count: 1 },
    ]);
  });

  test('should limit top violators to 10', () => {
    for (let i = 0; i < 15; i++) {
      recordRateLimitEvent({ endpoint: '/test', key: `user${i}`, limitType: 'general', isLimited: true });
    }
    const analytics = getRateLimitAnalytics();
    expect(analytics.topViolators.length).toBe(10);
    expect(analytics.topViolators[0].key).toBe('user0'); // Assuming consistent iteration order
  });

  test('should clear all analytics data', () => {
    recordRateLimitEvent({ endpoint: '/test', key: 'user1', limitType: 'general', isLimited: true });
    clearRateLimitAnalytics();
    const analytics = getRateLimitAnalytics();
    expect(analytics.totalEvents).toBe(0);
    expect(analytics.limitedEvents).toBe(0);
    expect(analytics.limitedPercentage).toBe(0);
    expect(analytics.hitsByEndpoint).toEqual({});
    expect(analytics.hitsByLimitType).toEqual({});
    expect(analytics.topViolators).toEqual([]);
  });

  test('should handle no events gracefully', () => {
    const analytics = getRateLimitAnalytics();
    expect(analytics.totalEvents).toBe(0);
    expect(analytics.limitedEvents).toBe(0);
    expect(analytics.limitedPercentage).toBe(0);
    expect(analytics.hitsByEndpoint).toEqual({});
    expect(analytics.hitsByLimitType).toEqual({});
    expect(analytics.topViolators).toEqual([]);
  });

  test('should not record non-limited events in hits or violators', () => {
    recordRateLimitEvent({ endpoint: '/test', key: 'user1', limitType: 'general', isLimited: false });
    const analytics = getRateLimitAnalytics();
    expect(analytics.totalEvents).toBe(1);
    expect(analytics.limitedEvents).toBe(0);
    expect(analytics.hitsByEndpoint).toEqual({});
    expect(analytics.hitsByLimitType).toEqual({});
    expect(analytics.topViolators).toEqual([]);
  });
});
