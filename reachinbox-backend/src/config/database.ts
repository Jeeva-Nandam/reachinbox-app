import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

prisma.$on("error" as never, (e: unknown) => logger.error({ e }, "Prisma error"));
prisma.$on("warn" as never, (e: unknown) => logger.warn({ e }, "Prisma warning"));

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, "PostgreSQL connection check failed");
    return false;
  }
}
