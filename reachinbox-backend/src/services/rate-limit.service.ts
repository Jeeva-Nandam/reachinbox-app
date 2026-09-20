import { redisConnection } from "../config/redis";
import { hourWindowKey, msUntilNextHour } from "../utils/time";
import { childLogger } from "../utils/logger";

const log = childLogger({ module: "rate-limit" });

/**
 * Atomic "check-and-increment" Lua script.
 *
 * Why Lua and not `INCR` + a separate check in application code: if two workers
 * both read the counter, both see it's under the limit, and then both INCR, you
 * can overshoot the limit (a classic check-then-act race). Running the check and
 * the increment as a single Lua script makes Redis execute it atomically — no
 * other client's commands can interleave between the GET and the INCR — so the
 * limit is enforced correctly even with many concurrent workers/processes.
 *
 * KEYS[1] = counter key, e.g. email-rate:{senderId}:{hourWindow}
 * ARGV[1] = hourly limit
 * ARGV[2] = TTL seconds for the key (so old hour buckets self-expire)
 *
 * Returns: { allowed (1/0), currentCount }
 */
const CHECK_AND_INCREMENT_SCRIPT = `
local current = tonumber(redis.call("GET", KEYS[1]) or "0")
local limit = tonumber(ARGV[1])
if current >= limit then
  return {0, current}
end
local newVal = redis.call("INCR", KEYS[1])
if newVal == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[2])
end
return {1, newVal}
`;

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  hourWindow: string;
  retryAfterMs: number;
}

function rateKey(senderId: string, hourWindow: string): string {
  return `email-rate:${senderId}:${hourWindow}`;
}

export class RateLimitService {
  /**
   * Attempts to reserve one "slot" for this sender in the current hour window.
   * Atomic across any number of concurrent worker processes.
   */
  async tryConsume(senderId: string, hourlyLimit: number, now: Date = new Date()): Promise<RateLimitCheckResult> {
    const window = hourWindowKey(now);
    const key = rateKey(senderId, window);
    // TTL a bit over an hour so a bucket never lingers past its window but survives
    // minor clock skew between the check and the EXPIRE call.
    const ttlSeconds = 2 * 60 * 60;

    const [allowedRaw, countRaw] = (await redisConnection.eval(
      CHECK_AND_INCREMENT_SCRIPT,
      1,
      key,
      hourlyLimit,
      ttlSeconds
    )) as [number, number];

    const allowed = allowedRaw === 1;
    if (!allowed) {
      log.debug({ senderId, window, hourlyLimit }, "Rate limit reached for sender/window");
    }

    return {
      allowed,
      currentCount: countRaw,
      hourWindow: window,
      retryAfterMs: allowed ? 0 : msUntilNextHour(now),
    };
  }

  /** Read-only peek, used by APIs/tests without consuming a slot. */
  async peek(senderId: string, now: Date = new Date()): Promise<number> {
    const window = hourWindowKey(now);
    const val = await redisConnection.get(rateKey(senderId, window));
    return val ? parseInt(val, 10) : 0;
  }
}

export const rateLimitService = new RateLimitService();
