import { createHash, randomUUID } from "crypto";

/**
 * Deterministic "batch key" for one schedule request.
 *
 * If the client supplies an `Idempotency-Key` header (recommended, standard practice
 * for POST retries), we use it verbatim. Otherwise we derive a deterministic hash from
 * the semantically-significant request fields, so an exact retry of the same request
 * (same subject/body/startTime/sender/recipient-set) collapses to the same batch key,
 * while two genuinely different requests (even sent seconds apart) do not collide.
 */
export function buildBatchKey(params: {
  clientIdempotencyKey?: string;
  tenantId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  recipients: string[];
}): string {
  if (params.clientIdempotencyKey && params.clientIdempotencyKey.trim().length > 0) {
    return params.clientIdempotencyKey.trim();
  }
  const normalizedRecipients = [...params.recipients].map((r) => r.trim().toLowerCase()).sort();
  const raw = JSON.stringify({
    tenantId: params.tenantId,
    senderId: params.senderId,
    subject: params.subject,
    body: params.body,
    startTime: params.startTime,
    delayBetweenEmailsMs: params.delayBetweenEmailsMs,
    hourlyLimit: params.hourlyLimit,
    recipients: normalizedRecipients,
  });
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Per-email idempotency key: unique per (tenant, batch, recipient). This is what
 * gets the DB unique constraint, and is also used to derive the deterministic
 * BullMQ job ID so the same logical email never gets two jobs.
 */
export function buildIdempotencyKey(parts: { tenantId: string; batchKey: string; recipient: string }): string {
  const raw = `${parts.tenantId}:${parts.batchKey}:${parts.recipient.trim().toLowerCase()}`;
  return createHash("sha256").update(raw).digest("hex");
}

export function newScheduleId(): string {
  return randomUUID();
}
