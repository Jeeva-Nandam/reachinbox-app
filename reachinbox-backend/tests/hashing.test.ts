import { describe, it, expect } from "vitest";
import { buildBatchKey, buildIdempotencyKey } from "../src/utils/hashing";

const baseParams = {
  tenantId: "tenant-1",
  senderId: "sender-1",
  subject: "Welcome",
  body: "Hello there",
  startTime: "2026-09-20T10:00:00.000Z",
  delayBetweenEmailsMs: 2000,
  hourlyLimit: 100,
  recipients: ["john@gmail.com", "alice@gmail.com"],
};

describe("buildBatchKey", () => {
  it("is deterministic for identical requests (retry-safe)", () => {
    const key1 = buildBatchKey(baseParams);
    const key2 = buildBatchKey({ ...baseParams });
    expect(key1).toBe(key2);
  });

  it("is order-independent for recipients", () => {
    const key1 = buildBatchKey(baseParams);
    const key2 = buildBatchKey({ ...baseParams, recipients: ["alice@gmail.com", "john@gmail.com"] });
    expect(key1).toBe(key2);
  });

  it("changes when semantically significant fields change", () => {
    const key1 = buildBatchKey(baseParams);
    const key2 = buildBatchKey({ ...baseParams, subject: "Different subject" });
    expect(key1).not.toBe(key2);
  });

  it("prefers a client-supplied idempotency key verbatim", () => {
    const key = buildBatchKey({ ...baseParams, clientIdempotencyKey: "my-custom-key" });
    expect(key).toBe("my-custom-key");
  });
});

describe("buildIdempotencyKey", () => {
  it("differs per recipient within the same batch", () => {
    const k1 = buildIdempotencyKey({ tenantId: "t1", batchKey: "b1", recipient: "john@gmail.com" });
    const k2 = buildIdempotencyKey({ tenantId: "t1", batchKey: "b1", recipient: "alice@gmail.com" });
    expect(k1).not.toBe(k2);
  });

  it("is case-insensitive on recipient", () => {
    const k1 = buildIdempotencyKey({ tenantId: "t1", batchKey: "b1", recipient: "John@Gmail.com" });
    const k2 = buildIdempotencyKey({ tenantId: "t1", batchKey: "b1", recipient: "john@gmail.com" });
    expect(k1).toBe(k2);
  });
});
