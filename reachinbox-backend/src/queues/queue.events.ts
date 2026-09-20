import { QueueEvents } from "bullmq";
import { redisConnection } from "../config/redis";
import { EMAIL_QUEUE_NAME } from "./email.queue";
import { childLogger } from "../utils/logger";

const log = childLogger({ module: "queue-events" });

export function startQueueEventListeners(): QueueEvents {
  const queueEvents = new QueueEvents(EMAIL_QUEUE_NAME, { connection: redisConnection });

  queueEvents.on("waiting", ({ jobId }) => log.debug({ jobId }, "job waiting"));
  queueEvents.on("delayed", ({ jobId }) => log.debug({ jobId }, "job delayed"));
  queueEvents.on("active", ({ jobId }) => log.info({ jobId }, "job picked up"));
  queueEvents.on("completed", ({ jobId }) => log.info({ jobId }, "job completed"));
  queueEvents.on("failed", ({ jobId, failedReason }) => log.warn({ jobId, failedReason }, "job failed"));
  queueEvents.on("retries-exhausted", ({ jobId }) => log.error({ jobId }, "job retries exhausted"));

  return queueEvents;
}
