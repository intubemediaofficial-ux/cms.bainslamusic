import Redis from "ioredis";

// Connect to DigitalOcean Redis server
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisInstance: Redis | null = null;

function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      connectTimeout: 10000,
      lazyConnect: true,
    });
    redisInstance.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });
  }
  return redisInstance;
}

/**
 * Drop-in replacement for @vercel/kv
 * Provides the same API: get, set, del, keys, setex, incr, expire, hget, hset, hgetall
 */
export const kv = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const redis = getRedis();
    const val = await redis.get(key);
    if (val === null) return null;
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as unknown as T;
    }
  },

  async set(key: string, value: unknown, options?: { ex?: number }): Promise<"OK"> {
    const redis = getRedis();
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (options?.ex) {
      await redis.setex(key, options.ex, serialized);
    } else {
      await redis.set(key, serialized);
    }
    return "OK";
  },

  async setIfNotExists(key: string, value: unknown, seconds: number): Promise<boolean> {
    const redis = getRedis();
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    const result = await redis.set(key, serialized, "EX", seconds, "NX");
    return result === "OK";
  },

  async setex(key: string, seconds: number, value: unknown): Promise<"OK"> {
    const redis = getRedis();
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    await redis.setex(key, seconds, serialized);
    return "OK";
  },

  async del(...keys: string[]): Promise<number> {
    const redis = getRedis();
    return redis.del(...keys);
  },

  async keys(pattern: string): Promise<string[]> {
    const redis = getRedis();
    return redis.keys(pattern);
  },

  async incr(key: string): Promise<number> {
    const redis = getRedis();
    return redis.incr(key);
  },

  async expire(key: string, seconds: number): Promise<number> {
    const redis = getRedis();
    return redis.expire(key, seconds);
  },

  async hget(key: string, field: string): Promise<string | null> {
    const redis = getRedis();
    return redis.hget(key, field);
  },

  async hset(key: string, field: string, value: string): Promise<number> {
    const redis = getRedis();
    return redis.hset(key, field, value);
  },

  async hgetall(key: string): Promise<Record<string, string>> {
    const redis = getRedis();
    return redis.hgetall(key);
  },

  async ttl(key: string): Promise<number> {
    const redis = getRedis();
    return redis.ttl(key);
  },
};
