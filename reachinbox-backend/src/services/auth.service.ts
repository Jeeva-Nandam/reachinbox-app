import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { JwtPayload } from "../types/auth.types";

export interface GoogleProfileInput {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export class AuthService {
  /**
   * Finds an existing user by googleId, or creates a new User + a Tenant owned
   * by that user (spec §4: "a user can own one tenant" for this internship-scope
   * implementation).
   */
  async findOrCreateFromGoogle(profile: GoogleProfileInput) {
    const existing = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
    if (existing) return existing;

    return prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: `${profile.name}'s workspace` } });
      return tx.user.create({
        data: {
          googleId: profile.googleId,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          tenantId: tenant.id,
        },
      });
    });
  }

  issueToken(userId: string, tenantId: string, email: string): string {
    const payload: JwtPayload = { sub: userId, tenantId, email };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  }

  /**
   * Dev-only convenience: creates (or reuses) a single fixed development user +
   * tenant so Phase 1 endpoints can be exercised with curl/Swagger before the
   * frontend exists, WITHOUT weakening production auth (only active when
   * NODE_ENV=development AND DEV_AUTH_BYPASS=true — see auth.middleware.ts).
   */
  async getOrCreateDevUser() {
    const devGoogleId = "dev-local-user";
    const existing = await prisma.user.findUnique({ where: { googleId: devGoogleId } });
    if (existing) return existing;
    return this.findOrCreateFromGoogle({
      googleId: devGoogleId,
      email: "dev@localhost",
      name: "Local Dev User",
    });
  }
}

export const authService = new AuthService();
