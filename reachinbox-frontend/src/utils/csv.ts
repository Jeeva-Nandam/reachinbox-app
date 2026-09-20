const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CsvParsePreview {
  valid: string[];
  invalid: string[];
  duplicatesRemoved: number;
}

/**
 * A lightweight, client-side mirror of the backend's own CSV detection logic
 * (src/services/email.service.ts on the backend), used purely to give the user
 * fast feedback ("250 email addresses detected") before they submit. The backend
 * re-parses and re-validates the uploaded file itself — this preview never
 * replaces that; nothing here is treated as authoritative.
 */
export function parseCsvPreview(text: string): CsvParsePreview {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","))
    .filter((row) => row.some((cell) => cell.trim().length > 0));

  if (rows.length === 0) {
    return { valid: [], invalid: [], duplicatesRemoved: 0 };
  }

  let cells: string[];
  const header = rows[0];
  const emailColumnIndex = header.findIndex((h) => /e[-\s]?mail/i.test(h.trim()));

  if (emailColumnIndex >= 0) {
    cells = rows.slice(1).map((row) => (row[emailColumnIndex] ?? "").trim());
  } else {
    // No header column named "email" — scan every cell across every row.
    cells = rows.flat().map((c) => c.trim());
  }

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  let duplicatesRemoved = 0;

  for (const raw of cells) {
    if (!raw) continue;
    const normalized = raw.toLowerCase();
    if (EMAIL_REGEX.test(raw)) {
      if (seen.has(normalized)) {
        duplicatesRemoved++;
      } else {
        seen.add(normalized);
        valid.push(raw);
      }
    } else if (!/e[-\s]?mail/i.test(raw)) {
      // Skip the literal header cell "email" from being reported as invalid.
      invalid.push(raw);
    }
  }

  return { valid, invalid, duplicatesRemoved };
}
