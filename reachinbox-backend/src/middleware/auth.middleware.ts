import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { authService } from "../services/auth.service";
import { UnauthenticatedError } from "../utils/errors";
import { asyncHandler } from "./error.middleware";

/**
 * Requires a valid JWT (Authorization: Bearer <token>) and attaches
 * req.currentUser = { id, tenantId, email, name }.
 *
 * Dev bypass: ONLY takes effect when both NODE_ENV=development AND
 * DEV_AUTH_BYPASS=true are set, and ONLY when no Authorization header was sent.
 * If a Bearer token IS sent, it is always verified normally — the bypass never
 * weakens or overrides real authentication, it only fills in for it when testing
 * locally without a frontend (spec §23).
 */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header) {
    if (env.NODE_ENV === "development" && env.DEV_AUTH_BYPASS) {
      const devUser = await authService.getOrCreateDevUser();
      req.currentUser = { id: devUser.id, tenantId: devUser.tenantId, email: devUser.email, name: devUser.name };
      return next();
    }
    throw new UnauthenticatedError("Missing Authorization header");
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new UnauthenticatedError("Authorization header must be 'Bearer <token>'");
  }

  let payload;
  try {
    payload = authService.verifyToken(token);
  } catch {
    throw new UnauthenticatedError("Invalid or expired token");
  }
  req.currentUser = { id: payload.sub, tenantId: payload.tenantId, email: payload.email, name: "" };
  next();
});
