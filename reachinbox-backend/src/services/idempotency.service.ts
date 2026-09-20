import { redisConnection } from "../config/redis";

/**
 * The email-level idempotency guarantee comes from two layers, not this file alone:
 *
 * 1. DB layer: `Email.idempotencyKey` has a `@@unique([tenantId, idempotencyKey])`
 *    constraint in Prisma. Creating emails for a batch uses `createMany` with
 *    `skipDuplicates: true` (Postgres `ON CONFLICT DO NOTHING`), so re-submitting
 *    the same schedule request (same batchKey) twice never creates a second row.
 * 2. Queue layer: the BullMQ job ID is deterministically derived from the email's
 *    DB id (`email:{emailId}`), so even if application code accidentally tried to
 *    enqueue twice, BullMQ treats the second `add()` as a no-op.
 *
 * What lives here is a *third*, narrower kind of idempotency: making sure we send
 * at most one Slack "rate limit reached" notification per (sender, hour window),
 * even though many worker jobs can hit the limit in the same window concurrently.
 * We use Redis SETNX (via `set ... NX`) which is a single atomic operation - only
 * one caller across any number of processes will ever get `true` back for a given
 * key, so only one of them actually sends the Slack message.
 */
export class IdempotencyService {
  private slackNotifyKey(senderId: string, hourWindow: string): string {
    return `slack-rate-limit-notified:${senderId}:${hourWindow}`;
  }

  /** Returns true if this call is the first to claim the notification for this window. */
  async claimSlackRateLimitNotification(senderId: string, hourWindow: string): Promise<boolean> {
    const key = this.slackNotifyKey(senderId, hourWindow);
    const result = await redisConnection.set(key, "1", "EX", 2 * 60 * 60, "NX");
    return result === "OK";
  }
}

export const idempotencyService = new IdempotencyService();
