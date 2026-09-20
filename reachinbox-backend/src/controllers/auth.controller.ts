import { Request, Response } from "express";
import { passport } from "../config/oauth";
import { authService } from "../services/auth.service";
import { asyncHandler } from "../middleware/error.middleware";
import { env } from "../config/env";
import { ForbiddenError } from "../utils/errors";
import { prisma } from "../config/database";

export const googleAuthStart = passport.authenticate("google", {
  scope: ["profile", "email"],
  session: false,
});

export const googleAuthCallback = [
  passport.authenticate("google", { session: false, failureRedirect: `${env.FRONTEND_URL}/login?error=oauth_failed` }),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as unknown as { id: string; tenantId: string; email: string };
    const token = authService.issueToken(user.id, user.tenantId, user.email);
    // Browser OAuth must finish at the frontend so it can persist the token and
    // load the authenticated dashboard.
    if (req.headers.accept?.includes("application/json")) {
      return res.json({ success: true, data: { token } });
    }
    res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`);
  }),
];

/**
 * Development-only convenience login that issues a real JWT for a fixed local dev
 * user, so Phase 1 endpoints can be tested before Google OAuth is configured.
 * Guarded so it can NEVER be reached outside development with DEV_AUTH_BYPASS=true
 * (spec §23: "do NOT weaken production authentication").
 */
export const devLogin = asyncHandler(async (req: Request, res: Response) => {
  if (env.NODE_ENV !== "development" || !env.DEV_AUTH_BYPASS) {
    throw new ForbiddenError("Dev login is disabled outside development (set DEV_AUTH_BYPASS=true to enable)");
  }
  const user = await authService.getOrCreateDevUser();
  const token = authService.issueToken(user.id, user.tenantId, user.email);
  res.json({ success: true, data: { token, user: { id: user.id, email: user.email, tenantId: user.tenantId } } });
});

export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.currentUser!.id } });
  res.json({ success: true, data: user });
});
