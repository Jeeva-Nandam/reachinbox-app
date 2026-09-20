import { Router } from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue } from "../queues/email.queue";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth.middleware";

/**
 * Mounts Bull Board at /admin/queues. Protected by the same JWT auth as the rest
 * of the API in production; in local development you can also reach it directly
 * since DEV_AUTH_BYPASS covers it too (spec §26: "Protect this route with
 * authentication or development-only access").
 */
export function buildBullBoardRouter(): Router {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue) as unknown as Parameters<typeof createBullBoard>[0]["queues"][number]],
    serverAdapter,
  });

  const router = Router();
  if (env.NODE_ENV !== "development" || !env.DEV_AUTH_BYPASS) {
    router.use(requireAuth);
  }
  router.use("/", serverAdapter.getRouter());
  return router;
}
