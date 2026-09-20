import { parse } from "csv-parse/sync";
import { prisma } from "../config/database";
import { NotFoundError, ValidationError } from "../utils/errors";
import { EmailStatus } from "@prisma/client";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CsvParseResult {
  recipients: string[];
  invalid: string[];
}

export class EmailService {
  /**
   * Parses recipient email addresses out of an uploaded CSV buffer.
   *
   * - If the CSV has a header row containing a column literally or loosely named
   *   "email" (case-insensitive, tolerating "email address", "e-mail", etc.), we
   *   read that column.
   * - Otherwise we fall back to treating the CSV as headerless / single-column and
   *   scan every cell for something that looks like an email address.
   * - Never assumes single-column input (spec §6): a CSV with unrelated columns and
   *   one email column is handled by the header-detection path above.
   */
  parseRecipientsFromCsv(buffer: Buffer): CsvParseResult {
    const text = buffer.toString("utf-8").trim();
    if (!text) {
      throw new ValidationError("CSV file is empty");
    }

    let rows: Record<string, string>[] | string[][];
    let hasHeader = false;

    try {
      const withHeader = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<
        string,
        string
      >[];
      const headerNames = withHeader.length > 0 ? Object.keys(withHeader[0]) : [];
      const emailColumn = headerNames.find((h) => /e[-\s]?mail/i.test(h));
      if (emailColumn) {
        rows = withHeader;
        hasHeader = true;
        return this.extractFromColumn(withHeader, emailColumn);
      }
    } catch {
      // fall through to headerless parsing below
    }

    const raw = parse(text, { columns: false, skip_empty_lines: true, trim: true }) as string[][];
    if (raw.length === 0) {
      throw new ValidationError("CSV file has no rows");
    }
    return this.extractFromAnyCell(raw);
  }

  private extractFromColumn(rows: Record<string, string>[], column: string): CsvParseResult {
    const recipients: string[] = [];
    const invalid: string[] = [];
    for (const row of rows) {
      const value = (row[column] ?? "").trim();
      if (!value) continue;
      if (EMAIL_REGEX.test(value)) recipients.push(value);
      else invalid.push(value);
    }
    if (recipients.length === 0) {
      throw new ValidationError("No valid email addresses found in the detected email column", { invalid });
    }
    return { recipients, invalid };
  }

  private extractFromAnyCell(rows: string[][]): CsvParseResult {
    const recipients: string[] = [];
    const invalid: string[] = [];
    let startIdx = 0;
    // Skip a header-like first row (e.g. "email") that isn't itself a valid address.
    if (rows[0].length > 0 && !EMAIL_REGEX.test(rows[0][0]) && /e[-\s]?mail/i.test(rows[0][0])) {
      startIdx = 1;
    }
    for (let i = startIdx; i < rows.length; i++) {
      for (const cell of rows[i]) {
        const value = (cell ?? "").trim();
        if (!value) continue;
        if (EMAIL_REGEX.test(value)) recipients.push(value);
      }
    }
    if (recipients.length === 0) {
      throw new ValidationError("Could not find an 'email' column or any valid email addresses in the CSV");
    }
    return { recipients, invalid };
  }

  async getById(tenantId: string, emailId: string) {
    const email = await prisma.email.findFirst({ where: { id: emailId, tenantId } });
    if (!email) throw new NotFoundError("Email");
    return email;
  }

  async listScheduled(tenantId: string, page: number, limit: number) {
    return this.list(tenantId, ["scheduled", "processing", "rate_limited"], page, limit, "scheduledAt", "asc");
  }

  async listSent(tenantId: string, page: number, limit: number) {
    return this.list(tenantId, ["sent", "failed"], page, limit, "sentAt", "desc");
  }

  private async list(
    tenantId: string,
    statuses: EmailStatus[],
    page: number,
    limit: number,
    sortField: "scheduledAt" | "sentAt",
    sortDir: "asc" | "desc"
  ) {
    const where = { tenantId, status: { in: statuses } };
    const [total, items] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      items,
    };
  }
}

export const emailService = new EmailService();
