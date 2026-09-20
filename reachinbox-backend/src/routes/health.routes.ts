import { Router } from "express";
import { checkDatabaseConnection } from "../config/database";
import { checkRedisConnection } from "../config/redis";
import { checkElasticsearchConnection } from "../config/elasticsearch";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      service: "reachinbox-backend",
      status: "ok",
      health: "/health",
      docs: "/api-docs",
    },
  });
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/health/ready", async (_req, res) => {
  const [database, redis, elasticsearch] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
    checkElasticsearchConnection(),
  ]);

  // Elasticsearch is intentionally non-critical (spec §20): its unavailability
  // does not flip overall readiness to "not ready", since the core send pipeline
  // does not depend on it. Postgres and Redis are both required.
  const ready = database && redis;

  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    database: database ? "connected" : "disconnected",
    redis: redis ? "connected" : "disconnected",
    elasticsearch: elasticsearch ? "connected" : "disconnected",
  });
});

export default router;
