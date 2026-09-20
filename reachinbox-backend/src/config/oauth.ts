import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { env } from "./env";
import { authService } from "../services/auth.service";
import { logger } from "../utils/logger";

export function configurePassport(): void {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    logger.warn(
      "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not set — /api/auth/google will fail until configured. See README 'Accounts / External Setup Required'."
    );
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID || "unconfigured",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "unconfigured",
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("Google profile did not include an email address"));
          }
          const user = await authService.findOrCreateFromGoogle({
            googleId: profile.id,
            email,
            name: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
          });
          return done(null, user as unknown as Express.User);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  // We use JWTs for API auth (see auth.middleware.ts), not persistent sessions, so
  // these are minimal pass-throughs required by Passport's OAuth dance itself.
  passport.serializeUser((user, done) => done(null, (user as any).id));
  passport.deserializeUser((id: string, done) => done(null, { id } as any));
}

export { passport };
