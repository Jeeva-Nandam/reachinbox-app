import IORedis, { Redis } from "ioredis";
import { env } from "./env";
import { logger } from "../utils/logger";

/**
 * A single shared ioredis connection, configured the way BullMQ requires
 * (maxRetriesPerRequest: null so BullMQ's blocking commands aren't killed early).
 * We reuse this same connection for our own atomic rate-limit / idempotency Lua
 * scripts too, since BullMQ is fine sharing a non-blocking connection for that.
 */
export const redisConnection: Redis = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
});

redisConnection.on("error", (err) => {
  logger.error({ err }, "Redis connection error");
});

redisConnection.on("connect", () => {
  logger.info("Redis connected");
});

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redisConnection.ping();
    return pong === "PONG";
  } catch (err) {
    logger.error({ err }, "Redis connection check failed");
    return false;
  }
}
