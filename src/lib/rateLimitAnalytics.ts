
export interface RateLimitEvent {
  endpoint: string;
  key: string; // user/IP or combined key
  limitType: string; // e.g., 'general', 'auth', 'apiKeyCreation'
  isLimited: boolean; // true if the request was actually limited
}

let totalEvents = 0;
let limitedEvents = 0;
const hitsByEndpoint: { [key: string]: number } = {};
const hitsByLimitType: { [key: string]: number } = {};
const topViolators: { [key: string]: number } = {};

export function recordRateLimitEvent(event: RateLimitEvent) {
  totalEvents++;
  if (event.isLimited) {
    limitedEvents++;
    hitsByEndpoint[event.endpoint] = (hitsByEndpoint[event.endpoint] || 0) + 1;
    hitsByLimitType[event.limitType] = (hitsByLimitType[event.limitType] || 0) + 1;
    topViolators[event.key] = (topViolators[event.key] || 0) + 1;
  }
}

export function getRateLimitAnalytics() {
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
  };
}

export function clearRateLimitAnalytics() {
  totalEvents = 0;
  limitedEvents = 0;
  for (const key in hitsByEndpoint) {
    delete hitsByEndpoint[key];
  }
  for (const key in hitsByLimitType) {
    delete hitsByLimitType[key];
  }
  for (const key in topViolators) {
    delete topViolators[key];
  }
}
