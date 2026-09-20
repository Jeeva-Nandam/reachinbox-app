import { Request, Response } from "express";
import { z } from "zod";
import { searchService } from "../services/search.service";
import { asyncHandler } from "../middleware/error.middleware";

const searchQuerySchema = z.object({
  q: z.string().optional().default(""),
  status: z.enum(["scheduled", "processing", "sent", "failed", "cancelled", "rate_limited"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchEmails = asyncHandler(async (req: Request, res: Response) => {
  const { q, status, page, limit } = searchQuerySchema.parse(req.query);
  const tenantId = req.currentUser!.tenantId;

  const result = await searchService.search({ tenantId, query: q, status, page, limit });

  res.json({
    success: true,
    data: { query: q, page, limit, total: result.total, results: result.hits },
  });
});
