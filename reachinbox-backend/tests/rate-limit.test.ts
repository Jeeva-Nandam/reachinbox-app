import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { rateLimitService } from "../src/services/rate-limit.service";
import { redisConnection } from "../src/config/redis";

/**
 * These tests exercise the real Redis Lua script, not a mock — the whole point of
 * the atomicity guarantee is Redis-level, so a mock would not actually prove
 * anything. Requires Redis to be running locally (see README).
 */
describe("RateLimitService (requires local Redis)", () => {
  const senderId = `test-sender-${Date.now()}`;

  beforeAll(async () => {
    await redisConnection.ping();
  });

  afterAll(async () => {
    const keys = await redisConnection.keys(`email-rate:${senderId}:*`);
    if (keys.length) await redisConnection.del(...keys);
  });

  it("allows exactly `limit` concurrent consumers and rejects the rest", async () => {
    const limit = 10;
    const attempts = 30;

    const results = await Promise.all(
      Array.from({ length: attempts }, () => rateLimitService.tryConsume(senderId, limit))
    );

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(limit);
  });

  it("distributes exactly limit-per-hour across a larger batch (approximation of spec §12)", async () => {
    const senderId2 = `test-sender-batch-${Date.now()}`;
    const limit = 2;
    const totalEmails = 5;

    const results = await Promise.all(
      Array.from({ length: totalEmails }, () => rateLimitService.tryConsume(senderId2, limit))
    );
    const allowed = results.filter((r) => r.allowed).length;
    const rejected = results.filter((r) => !r.allowed).length;

    expect(allowed).toBe(2);
    expect(rejected).toBe(3);

    const keys = await redisConnection.keys(`email-rate:${senderId2}:*`);
    if (keys.length) await redisConnection.del(...keys);
  });
});
