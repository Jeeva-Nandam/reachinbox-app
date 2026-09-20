import pino from "pino";
import { env } from "../config/env";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "password",
  "*.password",
  "*.smtpPassword",
  "*.accessToken",
  "*.token",
  "body",
  "*.body",
];

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
        }
      : undefined,
  base: { service: "reachinbox-backend" },
});

export function childLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
