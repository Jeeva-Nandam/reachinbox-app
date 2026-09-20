import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(""),

  ELASTICSEARCH_URL: z.string().default("http://localhost:9200"),
  ELASTICSEARCH_DISABLED: z.coerce.boolean().default(false),

  WORKER_CONCURRENCY: z.coerce.number().default(5),

  DEFAULT_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(200),
  MAX_CSV_RECIPIENTS: z.coerce.number().default(5000),
  MAX_CSV_FILE_SIZE_BYTES: z.coerce.number().default(5 * 1024 * 1024),

  ETHEREAL_HOST: z.string().default("smtp.ethereal.email"),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().optional().default(""),
  ETHEREAL_PASSWORD: z.string().optional().default(""),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_CALLBACK_URL: z.string().default("http://localhost:4000/api/auth/google/callback"),

  SLACK_CLIENT_ID: z.string().optional().default(""),
  SLACK_CLIENT_SECRET: z.string().optional().default(""),
  SLACK_REDIRECT_URI: z.string().default("http://localhost:4000/api/slack/callback"),
  SLACK_NOTIFY_CHANNEL: z.string().default("#general"),

  SESSION_SECRET: z.string().min(10, "SESSION_SECRET must be at least 10 chars"),
  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 chars"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  FRONTEND_URL: z.string().default("http://localhost:5173"),

  DEV_AUTH_BYPASS: z.coerce.boolean().default(false),

  RETRY_MAX_ATTEMPTS: z.coerce.number().default(4),
  RETRY_BACKOFF_DELAYS_MS: z.string().default("0,5000,30000,120000"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const retryBackoffDelays = env.RETRY_BACKOFF_DELAYS_MS.split(",").map((n) => parseInt(n.trim(), 10));
