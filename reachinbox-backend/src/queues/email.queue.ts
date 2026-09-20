import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";
import { retryBackoffDelays } from "../config/env";
import { EmailJobData } from "../types/email.types";

export const EMAIL_QUEUE_NAME = "email-queue";

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    // Custom backoff strategy (see queue.events.ts / worker) implements the
    // exact 0s / 5s / 30s / 2min schedule from the spec rather than BullMQ's
    // built-in exponential backoff, so we set attempts here and compute the
    // delay ourselves in the worker's failure handler via job.retry with a delay,
    // AND we also configure BullMQ's native backoff as a safety net.
    attempts: retryBackoffDelays.length,
    backoff: {
      type: "custom",
    },
    removeOnComplete: {
      age: 60 * 60 * 24 * 7, // keep completed jobs 7 days for Bull Board visibility
      count: 5000,
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 30,
    },
  },
});

/**
 * Deterministic BullMQ job ID derived from the email's DB id. This is the key
 * duplicate-processing guard: BullMQ refuses to enqueue a second job with the
 * same ID (it's a no-op), so even if our API-level idempotency check races and
 * two requests both attempt to create the same email row, only one BullMQ job
 * will ever exist for it.
 */
export function emailJobId(emailId: string): string {
  return `email:${emailId}`;
}
