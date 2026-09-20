import { Request, Response } from "express";
import { z } from "zod";
import { schedulerService } from "../services/scheduler.service";
import { emailService } from "../services/email.service";
import { asyncHandler } from "../middleware/error.middleware";
import { ValidationError } from "../utils/errors";
import { env } from "../config/env";

export const scheduleSchema = z.object({
  subject: z.string().min(1).max(998),
  body: z.string().min(1),
  startTime: z.string().datetime({ offset: true }).or(z.string().min(1)),
  delayBetweenEmailsMs: z.coerce.number().int().min(0).optional(),
  hourlyLimit: z.coerce.number().int().min(1).optional(),
  senderId: z.string().min(1),
  recipients: z.array(z.string().email()).min(1),
  idempotencyKey: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const scheduleEmail = asyncHandler(async (req: Request, res: Response) => {
  const input = scheduleSchema.parse(req.body);
  const tenantId = req.currentUser!.tenantId;
  const clientKey = req.headers["idempotency-key"] as string | undefined;

  const result = await schedulerService.scheduleBatch(tenantId, {
    ...input,
    idempotencyKey: input.idempotencyKey ?? clientKey,
  });

  res.status(201).json({ success: true, data: result });
});

export const scheduleEmailCsv = asyncHandler(async (req: Request, res: Response) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) throw new ValidationError("CSV file is required (multipart field name: 'file')");

  const meta = z
    .object({
      subject: z.string().min(1),
      body: z.string().min(1),
      startTime: z.string().min(1),
      delayBetweenEmailsMs: z.coerce.number().int().min(0).optional(),
      hourlyLimit: z.coerce.number().int().min(1).optional(),
      senderId: z.string().min(1),
    })
    .parse(req.body);

  const { recipients, invalid } = emailService.parseRecipientsFromCsv(file.buffer);

  if (recipients.length > env.MAX_CSV_RECIPIENTS) {
    throw new ValidationError(
      `CSV contains ${recipients.length} valid recipients, exceeding the configured limit of ${env.MAX_CSV_RECIPIENTS}`
    );
  }

  const tenantId = req.currentUser!.tenantId;
  const clientKey = req.headers["idempotency-key"] as string | undefined;

  const result = await schedulerService.scheduleBatch(tenantId, {
    ...meta,
    recipients,
    idempotencyKey: clientKey,
  });

  res.status(201).json({ success: true, data: { ...result, invalidRowsSkipped: invalid } });
});

export const listScheduled = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = paginationSchema.parse(req.query);
  const result = await emailService.listScheduled(req.currentUser!.tenantId, page, limit);
  res.json({ success: true, data: result });
});

export const listSent = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = paginationSchema.parse(req.query);
  const result = await emailService.listSent(req.currentUser!.tenantId, page, limit);
  res.json({ success: true, data: result });
});

export const getEmailById = asyncHandler(async (req: Request, res: Response) => {
  const email = await emailService.getById(req.currentUser!.tenantId, req.params.id);
  res.json({ success: true, data: email });
});

export const cancelEmail = asyncHandler(async (req: Request, res: Response) => {
  await schedulerService.cancel(req.currentUser!.tenantId, req.params.id);
  res.json({ success: true, data: { id: req.params.id, status: "cancelled" } });
});
