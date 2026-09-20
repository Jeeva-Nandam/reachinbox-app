import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { checkDatabaseConnection } from "./config/database";
import { checkRedisConnection } from "./config/redis";
import { ensureEmailsIndex } from "./config/elasticsearch";
import { redisConnection } from "./config/redis";
import { prisma } from "./config/database";
import { startEmailWorker } from "./queues/email.worker";
import { startQueueEventListeners } from "./queues/queue.events";

async function main() {
  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    logger.error("Cannot start: PostgreSQL is unreachable. Check DATABASE_URL and that Postgres is running.");
    process.exit(1);
  }

  const redisOk = await checkRedisConnection();
  if (!redisOk) {
    logger.error("Cannot start: Redis is unreachable. Check REDIS_HOST/REDIS_PORT and that Redis is running.");
    process.exit(1);
  }

  // Best-effort — Elasticsearch is not required for the API to boot (spec §20).
  await ensureEmailsIndex();

  const app = createApp();
  const queueEvents = startQueueEventListeners();
  const worker = startEmailWorker();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
    logger.info(`Swagger docs at http://localhost:${env.PORT}/api-docs`);
    logger.info(`Bull Board at http://localhost:${env.PORT}/admin/queues`);
    logger.info("Email worker is running in this process; scheduled jobs will be sent automatically.");
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close();
    await worker.close().catch(() => undefined);
    await queueEvents.close().catch(() => undefined);
    await redisConnection.quit().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
