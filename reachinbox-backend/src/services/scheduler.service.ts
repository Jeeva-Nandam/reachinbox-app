import { prisma } from "../config/database";
import { env } from "../config/env";
import { emailQueue, emailJobId } from "../queues/email.queue";
import { computeSendTime } from "../utils/time";
import { buildBatchKey, buildIdempotencyKey, newScheduleId } from "../utils/hashing";
import { ScheduleEmailInput, ScheduleResult } from "../types/email.types";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";
import { childLogger } from "../utils/logger";

const log = childLogger({ module: "scheduler" });

export class SchedulerService {
  /**
   * Creates Email rows for every (still-unique) recipient in the batch, then enqueues
   * one BullMQ delayed job per created row.
   *
   * Idempotency: recipients are de-duplicated up-front, and the whole batch is
   * addressed by a deterministic `batchKey` (see hashing.ts). Each row's
   * `idempotencyKey = hash(tenantId, batchKey, recipient)` is protected by a DB
   * unique constraint; `createMany({ skipDuplicates: true })` turns a retried
   * identical request into a safe no-op that creates zero new rows instead of
   * throwing or double-sending.
   */
  async scheduleBatch(tenantId: string, input: ScheduleEmailInput): Promise<ScheduleResult> {
    const sender = await prisma.sender.findFirst({ where: { id: input.senderId, tenantId, isActive: true } });
    if (!sender) throw new NotFoundError("Sender");

    const startTime = new Date(input.startTime);
    if (Number.isNaN(startTime.getTime())) {
      throw new ValidationError("startTime is not a valid date");
    }
    if (startTime.getTime() < Date.now() - 60_000) {
      // Allow a 1-minute grace window for clock skew / request latency; anything
      // further in the past is rejected rather than silently sent "immediately".
      throw new ValidationError("startTime must not be in the past");
    }

    const delayBetweenEmailsMs = input.delayBetweenEmailsMs ?? env.DEFAULT_DELAY_BETWEEN_EMAILS_MS;
    const hourlyLimit = input.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER;

    // De-duplicate recipients (case-insensitive) up front (spec §35 "Duplicate recipients").
    const seen = new Set<string>();
    const uniqueRecipients: string[] = [];
    for (const r of input.recipients) {
      const norm = r.trim().toLowerCase();
      if (!seen.has(norm)) {
        seen.add(norm);
        uniqueRecipients.push(r.trim());
      }
    }

    if (uniqueRecipients.length > env.MAX_CSV_RECIPIENTS) {
      throw new ValidationError(
        `Too many recipients: ${uniqueRecipients.length} exceeds the configured limit of ${env.MAX_CSV_RECIPIENTS}`
      );
    }

    const batchKey = buildBatchKey({
      clientIdempotencyKey: input.idempotencyKey,
      tenantId,
      senderId: input.senderId,
      subject: input.subject,
      body: input.body,
      startTime: startTime.toISOString(),
      delayBetweenEmailsMs,
      hourlyLimit,
      recipients: uniqueRecipients,
    });

    const scheduleId = newScheduleId();

    const rows = uniqueRecipients.map((recipient, index) => ({
      id: `${scheduleId}-${index}`,
      tenantId,
      senderId: input.senderId,
      recipient,
      subject: input.subject,
      body: input.body,
      scheduledAt: computeSendTime(startTime, index, delayBetweenEmailsMs),
      status: "scheduled" as const,
      idempotencyKey: buildIdempotencyKey({ tenantId, batchKey, recipient }),
      batchKey,
    }));

    // createMany + skipDuplicates relies on the @@unique([tenantId, idempotencyKey])
    // constraint in prisma/schema.prisma to make retried requests idempotent.
    const createResult = await prisma.email.createMany({ data: rows, skipDuplicates: true });

    // Fetch back exactly which rows exist for this batchKey (whether just-created
    // or pre-existing from an earlier identical request), so we enqueue jobs for
    // every row that needs one, without ever double-enqueuing an existing job
    // (deterministic BullMQ job IDs make that safe even if we did).
    const persisted = await prisma.email.findMany({
      where: { tenantId, batchKey, status: "scheduled" },
      orderBy: { scheduledAt: "asc" },
    });

    for (const email of persisted) {
      const jobId = emailJobId(email.id);
      const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());
      await emailQueue.add(
        "send-email",
        {
          emailId: email.id,
          tenantId: email.tenantId,
          senderId: email.senderId,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          hourlyLimit,
        },
        { jobId, delay: delayMs }
      );
      if (!email.bullJobId) {
        await prisma.email.update({ where: { id: email.id }, data: { bullJobId: jobId } });
      }
    }

    log.info(
      { tenantId, batchKey, requested: input.recipients.length, created: createResult.count },
      "Schedule batch processed"
    );

    return {
      batchKey,
      totalRequested: input.recipients.length,
      duplicatesSkipped: input.recipients.length - uniqueRecipients.length,
      created: persisted.map((e) => ({
        id: e.id,
        recipient: e.recipient,
        scheduledAt: e.scheduledAt.toISOString(),
        status: e.status,
      })),
    };
  }

  /**
   * Reschedules an email that hit the hourly rate limit: bump its scheduledAt into
   * the next hour window and re-add the BullMQ job with the new delay, using the
   * SAME deterministic job ID (BullMQ requires removing the old job first since a
   * job ID cannot be "moved"). This preserves per-recipient ordering as closely as
   * BullMQ's delayed-job scheduling allows, and never creates a duplicate DB row.
   */
  async rescheduleForRateLimit(emailId: string, nextAttemptAt: Date, hourlyLimit: number): Promise<void> {
    const email = await prisma.email.findUniqueOrThrow({ where: { id: emailId } });

    await prisma.email.update({
      where: { id: emailId },
      data: { status: "scheduled", scheduledAt: nextAttemptAt, lastError: "Delayed: hourly rate limit reached" },
    });

    const jobId = emailJobId(emailId);
    const existing = await emailQueue.getJob(jobId);
    if (existing) {
      await existing.remove().catch(() => undefined);
    }

    const delayMs = Math.max(0, nextAttemptAt.getTime() - Date.now());
    await emailQueue.add(
      "send-email",
      {
        emailId: email.id,
        tenantId: email.tenantId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        hourlyLimit,
      },
      { jobId, delay: delayMs }
    );
  }

  async cancel(tenantId: string, emailId: string): Promise<void> {
    const email = await prisma.email.findFirst({ where: { id: emailId, tenantId } });
    if (!email) throw new NotFoundError("Email");
    if (email.status !== "scheduled") {
      throw new ConflictError(`Cannot cancel an email in status "${email.status}"`);
    }

    const jobId = emailJobId(emailId);
    const job = await emailQueue.getJob(jobId);
    if (job) {
      await job.remove().catch(() => undefined);
    }

    await prisma.email.update({ where: { id: emailId }, data: { status: "cancelled" } });
  }
}

export const schedulerService = new SchedulerService();
