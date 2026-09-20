import { describe, it, expect } from "vitest";
import { parseCsvPreview } from "../src/utils/csv";

describe("parseCsvPreview", () => {
  it("detects emails under a header named 'email'", () => {
    const csv = "email\njohn@gmail.com\nalice@gmail.com\n";
    const result = parseCsvPreview(csv);
    expect(result.valid).toEqual(["john@gmail.com", "alice@gmail.com"]);
    expect(result.invalid).toHaveLength(0);
  });

  it("removes duplicate recipients (case-insensitive)", () => {
    const csv = "email\njohn@gmail.com\nJohn@Gmail.com\n";
    const result = parseCsvPreview(csv);
    expect(result.valid).toEqual(["john@gmail.com"]);
    expect(result.duplicatesRemoved).toBe(1);
  });

  it("reports invalid rows separately", () => {
    const csv = "email\njohn@gmail.com\nnot-an-email\n";
    const result = parseCsvPreview(csv);
    expect(result.valid).toEqual(["john@gmail.com"]);
    expect(result.invalid).toEqual(["not-an-email"]);
  });

  it("handles an empty file", () => {
    const result = parseCsvPreview("");
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });

  it("falls back to scanning all cells when no 'email' header exists", () => {
    const csv = "john@gmail.com\nalice@gmail.com\n";
    const result = parseCsvPreview(csv);
    expect(result.valid).toEqual(["john@gmail.com", "alice@gmail.com"]);
  });
});
