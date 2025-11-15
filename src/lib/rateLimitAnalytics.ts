
export interface RateLimitEvent {
  timestamp: number;
  endpoint: string;
  key: string; // user/IP or combined key
  limitType: string; // e.g., 'general', 'auth', 'apiKeyCreation'
  isLimited: boolean; // true if the request was actually limited
}

const rateLimitEvents: RateLimitEvent[] = [];
const MAX_EVENTS = 10000; // Keep a reasonable number of events in memory

export function recordRateLimitEvent(event: RateLimitEvent) {
  rateLimitEvents.push(event);
  if (rateLimitEvents.length > MAX_EVENTS) {
    rateLimitEvents.shift(); // Remove the oldest event
  }
}

export function getRateLimitAnalytics() {
  const totalEvents = rateLimitEvents.length;
  const limitedEvents = rateLimitEvents.filter(event => event.isLimited).length;

  const hitsByEndpoint: { [key: string]: number } = {};
  const hitsByLimitType: { [key: string]: number } = {};
  const topViolators: { [key: string]: number } = {};

  for (const event of rateLimitEvents) {
    if (event.isLimited) {
      hitsByEndpoint[event.endpoint] = (hitsByEndpoint[event.endpoint] || 0) + 1;
      hitsByLimitType[event.limitType] = (hitsByLimitType[event.limitType] || 0) + 1;
      topViolators[event.key] = (topViolators[event.key] || 0) + 1;
    }
  }

  // Sort top violators
  const sortedTopViolators = Object.entries(topViolators)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 10) // Top 10 violators
    .map(([key, count]) => ({ key, count }));

  return {
    timestamp: Date.now(),
    totalEvents,
    limitedEvents,
    limitedPercentage: totalEvents > 0 ? (limitedEvents / totalEvents) * 100 : 0,
    hitsByEndpoint,
    hitsByLimitType,
    topViolators: sortedTopViolators,
    // You can add more aggregations here, e.g., events over time
  };
}

export function clearRateLimitAnalytics() {
  rateLimitEvents.length = 0; // Clear the array
}
