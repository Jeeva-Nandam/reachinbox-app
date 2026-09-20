import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/database";
import { asyncHandler } from "../middleware/error.middleware";
import { NotFoundError } from "../utils/errors";
import { emailSenderService } from "../services/email-sender.service";

const createSenderSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  smtpHost: z.string().min(1).default("smtp.ethereal.email"),
  smtpPort: z.coerce.number().int().default(587),
  smtpUser: z.string().min(1),
  smtpPassword: z.string().min(1),
});

/**
 * Creates a Sender identity. For this assignment's Ethereal-only scope, smtpUser /
 * smtpPassword / email are the credentials you get from https://ethereal.email
 * (see README "Ethereal" section). Nothing here is hardcoded — the values live in
 * the request body / your own record-keeping, never in source control.
 */
export const createSender = asyncHandler(async (req: Request, res: Response) => {
  const input = createSenderSchema.parse(req.body);
  const sender = await prisma.sender.create({
    data: { ...input, tenantId: req.currentUser!.tenantId },
  });
  res.status(201).json({
    success: true,
    data: { id: sender.id, email: sender.email, displayName: sender.displayName, isActive: sender.isActive },
  });
});

export const listSenders = asyncHandler(async (req: Request, res: Response) => {
  const senders = await prisma.sender.findMany({
    where: { tenantId: req.currentUser!.tenantId },
    select: { id: true, email: true, displayName: true, isActive: true, createdAt: true },
  });
  res.json({ success: true, data: senders });
});

export const deleteSender = asyncHandler(async (req: Request, res: Response) => {
  const sender = await prisma.sender.findFirst({
    where: { id: req.params.id, tenantId: req.currentUser!.tenantId },
  });
  if (!sender) throw new NotFoundError("Sender");
  await prisma.sender.delete({ where: { id: sender.id } });
  emailSenderService.invalidate(sender.id);
  res.json({ success: true, data: { id: sender.id, deleted: true } });
});
