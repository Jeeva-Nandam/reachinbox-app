import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/config/database";
import { schedulerService } from "../src/services/scheduler.service";
import { emailQueue, emailJobId } from "../src/queues/email.queue";
import { redisConnection } from "../src/config/redis";

/**
 * Requires a local Postgres reachable via DATABASE_URL and migrations applied
 * (`npx prisma migrate dev`), plus local Redis. See README "Testing" section.
 */
describe("SchedulerService.scheduleBatch (requires local Postgres + Redis)", () => {
  let tenantId: string;
  let senderId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { name: "Test Tenant" } });
    tenantId = tenant.id;
    const sender = await prisma.sender.create({
      data: {
        tenantId,
        email: "sender@ethereal.email",
        displayName: "Test Sender",
        smtpHost: "smtp.ethereal.email",
        smtpPort: 587,
        smtpUser: "test-user",
        smtpPassword: "test-pass",
      },
    });
    senderId = sender.id;
  });

  afterAll(async () => {
    await prisma.email.deleteMany({ where: { tenantId } });
    await prisma.sender.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await redisConnection.quit();
    await prisma.$disconnect();
  });

  const baseInput = () => ({
    subject: "Integration test subject",
    body: "Integration test body",
    startTime: new Date(Date.now() + 60_000).toISOString(),
    delayBetweenEmailsMs: 1000,
    hourlyLimit: 100,
    senderId: "", // filled per-test
    recipients: ["john+test@gmail.com", "alice+test@gmail.com", "john+test@gmail.com"], // includes a duplicate
    idempotencyKey: `test-batch-${Date.now()}`,
  });

  it("creates one DB row per unique recipient and enqueues a delayed BullMQ job for each", async () => {
    const input = { ...baseInput(), senderId };
    const result = await schedulerService.scheduleBatch(tenantId, input);

    expect(result.created).toHaveLength(2); // duplicate recipient collapsed
    expect(result.duplicatesSkipped).toBe(1);

    for (const created of result.created) {
      const job = await emailQueue.getJob(emailJobId(created.id));
      expect(job).toBeTruthy();
      const state = await job!.getState();
      expect(["delayed", "waiting", "waiting-children"]).toContain(state);
    }
  });

  it("is idempotent: resubmitting the exact same request creates no new rows or jobs", async () => {
    const input = { ...baseInput(), senderId, idempotencyKey: `idempotent-test-${Date.now()}` };

    const first = await schedulerService.scheduleBatch(tenantId, input);
    const countAfterFirst = await prisma.email.count({ where: { tenantId, batchKey: first.batchKey } });

    const second = await schedulerService.scheduleBatch(tenantId, input);
    const countAfterSecond = await prisma.email.count({ where: { tenantId, batchKey: first.batchKey } });

    expect(second.batchKey).toBe(first.batchKey);
    expect(countAfterSecond).toBe(countAfterFirst);
    expect(second.created.map((c) => c.id).sort()).toEqual(first.created.map((c) => c.id).sort());
  });

  it("respects computeSendTime spacing across recipients", async () => {
    const start = new Date(Date.now() + 120_000);
    const input = {
      ...baseInput(),
      senderId,
      startTime: start.toISOString(),
      delayBetweenEmailsMs: 2000,
      recipients: ["a@gmail.com", "b@gmail.com", "c@gmail.com"],
      idempotencyKey: `spacing-test-${Date.now()}`,
    };
    const result = await schedulerService.scheduleBatch(tenantId, input);
    const sorted = [...result.created].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

    const t0 = new Date(sorted[0].scheduledAt).getTime();
    const t1 = new Date(sorted[1].scheduledAt).getTime();
    const t2 = new Date(sorted[2].scheduledAt).getTime();
    expect(t1 - t0).toBe(2000);
    expect(t2 - t1).toBe(2000);
  });
});
