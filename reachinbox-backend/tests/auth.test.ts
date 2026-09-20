import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { env } from "../src/config/env";

/**
 * This test is only meaningful with DEV_AUTH_BYPASS=false (the bypass, by design,
 * makes unauthenticated requests succeed as a fixed dev user — see auth.middleware.ts).
 * It's skipped automatically when the bypass is on so `npm test` doesn't produce a
 * false failure in the default local-dev .env.
 */
describe.skipIf(env.DEV_AUTH_BYPASS)("Authentication (requires DEV_AUTH_BYPASS=false)", () => {
  const app = createApp();

  it("rejects requests with no Authorization header", async () => {
    const res = await request(app).get("/api/emails/scheduled");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects requests with a malformed token", async () => {
    const res = await request(app).get("/api/emails/scheduled").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("rejects a schedule request with no auth", async () => {
    const res = await request(app).post("/api/emails/schedule").send({
      subject: "x",
      body: "y",
      startTime: new Date().toISOString(),
      senderId: "does-not-matter",
      recipients: ["a@b.com"],
    });
    expect(res.status).toBe(401);
  });
});

describe("Health endpoints (no auth required)", () => {
  const app = createApp();

  it("GET /health returns 200 without auth", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});
