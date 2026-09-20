import { WebClient } from "@slack/web-api";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { childLogger } from "../utils/logger";
import { idempotencyService } from "./idempotency.service";
import { SlackStatus } from "../types/slack.types";

const log = childLogger({ module: "slack" });

const SLACK_OAUTH_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_SCOPES = "chat:write,chat:write.public";

export class SlackService {
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      scope: SLACK_SCOPES,
      redirect_uri: env.SLACK_REDIRECT_URI,
      state,
    });
    return `${SLACK_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Exchanges the OAuth `code` for a bot token and persists the connection for the tenant. */
  async handleCallback(tenantId: string, code: string): Promise<void> {
    const client = new WebClient();
    const result = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    });

    if (!result.ok || !result.access_token || !result.team) {
      throw new Error(`Slack OAuth exchange failed: ${result.error ?? "unknown error"}`);
    }

    await prisma.slackConnection.upsert({
      where: { tenantId },
      create: {
        tenantId,
        teamId: result.team.id as string,
        teamName: (result.team.name as string) ?? "Unknown workspace",
        accessToken: result.access_token,
      },
      update: {
        teamId: result.team.id as string,
        teamName: (result.team.name as string) ?? "Unknown workspace",
        accessToken: result.access_token,
      },
    });

    log.info({ tenantId, teamId: result.team.id }, "Slack workspace connected");
  }

  async disconnect(tenantId: string): Promise<void> {
    await prisma.slackConnection.deleteMany({ where: { tenantId } });
  }

  async getStatus(tenantId: string): Promise<SlackStatus> {
    const conn = await prisma.slackConnection.findUnique({ where: { tenantId } });
    if (!conn) return { connected: false };
    return { connected: true, teamName: conn.teamName, connectedAt: conn.connectedAt.toISOString() };
  }

  /**
   * Sends the "hourly rate limit reached" notification for a sender, at most once
   * per (sender, hourWindow) — see idempotency.service.ts. If Slack isn't connected
   * for the tenant, this is a silent no-op: the email pipeline must keep working
   * regardless (spec §13).
   */
  async notifyRateLimitReached(params: {
    tenantId: string;
    senderEmail: string;
    hourlyLimit: number;
    hourWindow: string;
  }): Promise<void> {
    try {
      const conn = await prisma.slackConnection.findUnique({ where: { tenantId: params.tenantId } });
      if (!conn) return; // Slack not connected — do nothing, as required.

      const claimed = await idempotencyService.claimSlackRateLimitNotification(
        params.senderEmail,
        params.hourWindow
      );
      if (!claimed) return; // already notified for this sender+window

      const client = new WebClient(conn.accessToken);
      const [windowStart] = params.hourWindow.split("T").slice(-1);
      const hour = params.hourWindow.slice(-2);
      const rangeLabel = `${hour}:00 - ${(parseInt(hour, 10) + 1) % 24}:00 UTC`;

      await client.chat.postMessage({
        channel: env.SLACK_NOTIFY_CHANNEL,
        text:
          `⚠️ Email sending rate limit reached.\n\n` +
          `Sender: ${params.senderEmail}\n` +
          `Hourly limit: ${params.hourlyLimit}\n` +
          `Current window: ${rangeLabel}\n` +
          `Additional emails have been delayed.`,
      });
    } catch (err) {
      // Slack failures must never break email processing (spec §13/§14).
      log.warn({ err: (err as Error).message, tenantId: params.tenantId }, "Slack notification failed (non-fatal)");
    }
  }
}

export const slackService = new SlackService();
