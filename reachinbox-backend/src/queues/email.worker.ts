import { Job, Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { env, retryBackoffDelays } from "../config/env";
import { prisma } from "../config/database";
import { EMAIL_QUEUE_NAME } from "./email.queue";
import { EmailJobData } from "../types/email.types";
import { rateLimitService } from "../services/rate-limit.service";
import { schedulerService } from "../services/scheduler.service";
import { emailSenderService } from "../services/email-sender.service";
import { slackService } from "../services/slack.service";
import { searchService } from "../services/search.service";
import { nextHourWindowStart } from "../utils/time";
import { childLogger } from "../utils/logger";
import { startQueueEventListeners } from "./queue.events";

const log = childLogger({ module: "email-worker" });

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, tenantId, senderId, recipient, subject, body, hourlyLimit } = job.data;
  const jobLog = log.child({ emailId, jobId: job.id, tenantId, senderId, attemptsMade: job.attemptsMade });

  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) {
    jobLog.error("Email row not found — skipping (nothing safe to do)");
    return;
  }

  // Idempotency / duplicate-processing guards: if this email already reached a
  // terminal state (e.g. a previous worker attempt already sent it before a crash
  // prevented BullMQ from marking the job complete, or the user cancelled it),
  // skip silently instead of sending again.
  if (email.status === "sent") {
    jobLog.info("Email already sent — skipping duplicate job execution");
    return;
  }
  if (email.status === "cancelled") {
    jobLog.info("Email was cancelled — skipping");
    return;
  }

  // 1. Atomic hourly rate limit check (Redis Lua script — safe under concurrency).
  const rateResult = await rateLimitService.tryConsume(senderId, hourlyLimit);
  if (!rateResult.allowed) {
    const nextAttemptAt = nextHourWindowStart(new Date());
    jobLog.warn({ hourWindow: rateResult.hourWindow, nextAttemptAt }, "Hourly rate limit reached — rescheduling");

    await schedulerService.rescheduleForRateLimit(emailId, nextAttemptAt, hourlyLimit);

    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    if (sender) {
      await slackService.notifyRateLimitReached({
        tenantId,
        senderEmail: sender.email,
        hourlyLimit,
        hourWindow: rateResult.hourWindow,
      });
    }
    // Not a failure — this job's work is done; a new job carries the email forward.
    return;
  }

  // 2. Mark as processing (state machine: scheduled -> processing).
  await prisma.email.update({
    where: { id: emailId },
    data: { status: "processing", attempts: { increment: 1 } },
  });

  // 3. Send via Ethereal SMTP.
  try {
    const sender = await prisma.sender.findUniqueOrThrow({ where: { id: senderId } });
    const result = await emailSenderService.send({
      senderId,
      fromEmail: sender.email,
      fromName: sender.displayName,
      to: recipient,
      subject,
      body,
    });

    const updated = await prisma.email.update({
      where: { id: emailId },
      data: {
        status: "sent",
        sentAt: new Date(),
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        lastError: null,
      },
    });

    jobLog.info({ messageId: result.messageId, previewUrl: result.previewUrl }, "Email sent");

    // Best-effort search indexing — never allowed to affect send success (spec §20).
    void searchService.indexEmail(updated).then(() =>
      prisma.email.update({ where: { id: emailId }, data: { indexedAt: new Date() } }).catch(() => undefined)
    );
  } catch (err) {
    const error = err as Error;
    const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? retryBackoffDelays.length);

    if (isLastAttempt) {
      await prisma.email.update({
        where: { id: emailId },
        data: { status: "failed", lastError: error.message.slice(0, 1000) },
      });
      jobLog.error({ err: error.message }, "Email permanently failed after max attempts");
      return; // do not rethrow — we've recorded the terminal state ourselves
    }

    // Not the last attempt: revert to "scheduled" so list endpoints reflect
    // reality between retries, record the error, then rethrow so BullMQ retries
    // this job using our custom backoff strategy below.
    await prisma.email.update({
      where: { id: emailId },
      data: { status: "scheduled", lastError: error.message.slice(0, 1000) },
    });
    jobLog.warn({ err: error.message }, "Send failed — will retry");
    throw error;
  }
}

export function startEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: redisConnection,
    concurrency: env.WORKER_CONCURRENCY,
    settings: {
      // Implements the exact fixed backoff schedule from spec §18
      // (attempt1 immediate, then 5s / 30s / 2min) instead of BullMQ's built-in
      // exponential backoff.
      backoffStrategy: (attemptsMade: number) => {
        return retryBackoffDelays[attemptsMade] ?? retryBackoffDelays[retryBackoffDelays.length - 1];
      },
    } as any,
  });

  worker.on("error", (err) => log.error({ err }, "Worker-level error"));

  log.info({ concurrency: env.WORKER_CONCURRENCY }, "Email worker started");
  return worker;
}

// Allow running this file directly via `npm run worker` as its own process,
// separate from the API process (see README — two terminals, one for
// `npm run dev`, one for `npm run worker`).
if (require.main === module) {
  startQueueEventListeners();
  startEmailWorker();
  log.info("Worker process running standalone");
}
