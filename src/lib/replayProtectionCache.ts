
// src/lib/replayProtectionCache.ts
interface CacheEntry {
  timestamp: number;
  ttl: number;
}

class ReplayProtectionCache {
  private cache: Map<string, CacheEntry>;
  private cleanupInterval: ReturnType<typeof setInterval> | null;

  constructor(cleanupIntervalMs: number = 60 * 1000) { // Clean up every minute
    this.cache = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  public set(key: string, ttlSeconds: number): boolean {
    const now = Date.now();
    if (this.cache.has(key)) {
      return false; // Key already exists
    }
    this.cache.set(key, { timestamp: now, ttl: ttlSeconds * 1000 });
    return true;
  }

  public has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key); // Expired
      return false;
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  public get size(): number {
    return this.cache.size;
  }
}

export const replayProtectionCache = new ReplayProtectionCache();
