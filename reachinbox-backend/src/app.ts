import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { env } from "./config/env";
import { configurePassport, passport } from "./config/oauth";
import { logger } from "./utils/logger";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { buildBullBoardRouter } from "./config/bull-board";

import authRoutes from "./routes/auth.routes";
import emailRoutes from "./routes/email.routes";
import searchRoutes from "./routes/search.routes";
import slackRoutes from "./routes/slack.routes";
import healthRoutes from "./routes/health.routes";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  configurePassport();
  app.use(passport.initialize());

  // Rate limiting for public/auth-adjacent endpoints (spec §24) — generous limits
  // since this protects against abuse, not normal authenticated traffic.
  const publicLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
  app.use("/api/auth", publicLimiter);
  app.use("/api/slack/callback", publicLimiter);

  app.use((req, _res, next) => {
    logger.debug({ method: req.method, path: req.path }, "incoming request");
    next();
  });

  // Health checks (no auth — used by orchestrators/load balancers).
  app.use("/", healthRoutes);

  // Swagger / OpenAPI docs.
  const swaggerDocument = YAML.load(path.join(__dirname, "..", "swagger.yaml"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Bull Board dashboard.
  app.use("/admin/queues", buildBullBoardRouter());

  // API routes. NOTE: /api/emails/search is mounted BEFORE /api/emails so that
  // Express routes it to the search controller instead of falling into
  // /api/emails/:id (which would otherwise treat "search" as an email id).
  app.use("/api/auth", authRoutes);
  app.use("/api/emails/search", searchRoutes);
  app.use("/api/emails", emailRoutes);
  app.use("/api/slack", slackRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
