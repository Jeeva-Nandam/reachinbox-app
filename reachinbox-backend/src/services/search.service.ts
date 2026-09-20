import { Email } from "@prisma/client";
import { esClient, EMAILS_INDEX } from "../config/elasticsearch";
import { env } from "../config/env";
import { childLogger } from "../utils/logger";

const log = childLogger({ module: "search" });

export interface EmailSearchHit {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}

/**
 * Elasticsearch indexing is best-effort and must never block or fail the core
 * send pipeline (see spec §20). Every call here swallows its own errors and just
 * logs — callers (the worker, the schedule endpoint) do not await indexing as
 * part of their success/failure path for the email itself.
 */
export class SearchService {
  async indexEmail(email: Email): Promise<void> {
    if (env.ELASTICSEARCH_DISABLED) return;
    try {
      await esClient.index({
        index: EMAILS_INDEX,
        id: email.id,
        document: {
          id: email.id,
          tenantId: email.tenantId,
          senderId: email.senderId,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          status: email.status,
          scheduledAt: email.scheduledAt,
          sentAt: email.sentAt,
          createdAt: email.createdAt,
        },
      });
    } catch (err) {
      log.warn({ err: (err as Error).message, emailId: email.id }, "Elasticsearch indexing failed (non-fatal)");
    }
  }

  async search(params: {
    tenantId: string;
    query: string;
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ total: number; hits: EmailSearchHit[] }> {
    if (env.ELASTICSEARCH_DISABLED) {
      return { total: 0, hits: [] };
    }

    const must: any[] = [{ term: { tenantId: params.tenantId } }];

    if (params.query && params.query.trim().length > 0) {
      must.push({
        multi_match: {
          query: params.query,
          fields: ["recipient", "subject", "body"],
          fuzziness: "AUTO",
        },
      });
    }
    if (params.status) {
      must.push({ term: { status: params.status } });
    }

    const result = await esClient.search({
      index: EMAILS_INDEX,
      from: (params.page - 1) * params.limit,
      size: params.limit,
      query: { bool: { must } },
      sort: [{ scheduledAt: { order: "desc" } }],
    });

    const total =
      typeof result.hits.total === "number" ? result.hits.total : result.hits.total?.value ?? 0;

    const hits: EmailSearchHit[] = result.hits.hits.map((h) => {
      const src = h._source as any;
      return {
        id: src.id,
        recipient: src.recipient,
        subject: src.subject,
        status: src.status,
        scheduledAt: src.scheduledAt,
        sentAt: src.sentAt ?? null,
      };
    });

    return { total, hits };
  }
}

export const searchService = new SearchService();
