import { Client } from "@elastic/elasticsearch";
import { env } from "./env";
import { logger } from "../utils/logger";

export const EMAILS_INDEX = "emails";

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
  requestTimeout: 3000,
});

export async function checkElasticsearchConnection(): Promise<boolean> {
  if (env.ELASTICSEARCH_DISABLED) return false;
  try {
    const health = await esClient.cluster.health({});
    return health.status === "green" || health.status === "yellow";
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Elasticsearch connection check failed");
    return false;
  }
}

/**
 * Idempotently creates the `emails` index with explicit mappings. Safe to call on
 * every startup: if the index already exists we just skip creation.
 */
export async function ensureEmailsIndex(): Promise<void> {
  if (env.ELASTICSEARCH_DISABLED) {
    logger.warn("Elasticsearch is disabled via ELASTICSEARCH_DISABLED; skipping index setup");
    return;
  }
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (exists) {
      logger.info(`Elasticsearch index "${EMAILS_INDEX}" already exists`);
      return;
    }
    await esClient.indices.create({
      index: EMAILS_INDEX,
      mappings: {
        properties: {
          id: { type: "keyword" },
          tenantId: { type: "keyword" },
          senderId: { type: "keyword" },
          recipient: {
            type: "text",
            fields: { keyword: { type: "keyword" } },
          },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          scheduledAt: { type: "date" },
          sentAt: { type: "date" },
          createdAt: { type: "date" },
        },
      },
    });
    logger.info(`Created Elasticsearch index "${EMAILS_INDEX}"`);
  } catch (err) {
    logger.error({ err: (err as Error).message }, "Failed to ensure Elasticsearch index (non-fatal)");
  }
}
