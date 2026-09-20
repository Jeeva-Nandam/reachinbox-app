import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { slackService } from "../services/slack.service";
import { asyncHandler } from "../middleware/error.middleware";
import { env } from "../config/env";
import { ValidationError } from "../utils/errors";

/**
 * Slack's OAuth redirect is a plain browser GET with no Authorization header, so we
 * can't rely on the normal Bearer-JWT middleware for /connect or /callback. Instead
 * we encode the tenantId into Slack's `state` parameter as a short-lived signed JWT,
 * which Slack round-trips back to us verbatim on /callback. This ties the completed
 * OAuth flow back to the tenant that initiated it without needing server-side
 * session storage.
 */
export const connectSlack = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.currentUser!.tenantId;
  const state = jwt.sign({ tenantId }, env.JWT_SECRET, { expiresIn: "10m" });
  const url = slackService.buildAuthorizeUrl(state);
  res.json({ success: true, data: { authorizeUrl: url } });
});

export const slackCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error } = req.query as { code?: string; state?: string; error?: string };

  if (error) {
    return res.redirect(`${env.FRONTEND_URL}/settings/slack?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    throw new ValidationError("Missing code or state from Slack callback");
  }

  let tenantId: string;
  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as { tenantId: string };
    tenantId = payload.tenantId;
  } catch {
    throw new ValidationError("Invalid or expired Slack OAuth state");
  }

  await slackService.handleCallback(tenantId, code);
  res.redirect(`${env.FRONTEND_URL}/settings/slack?connected=true`);
});

export const disconnectSlack = asyncHandler(async (req: Request, res: Response) => {
  await slackService.disconnect(req.currentUser!.tenantId);
  res.json({ success: true, data: { connected: false } });
});

export const slackStatus = asyncHandler(async (req: Request, res: Response) => {
  const status = await slackService.getStatus(req.currentUser!.tenantId);
  res.json({ success: true, data: status });
});
