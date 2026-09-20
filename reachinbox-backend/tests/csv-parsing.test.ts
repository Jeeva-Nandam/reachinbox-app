import { describe, it, expect } from "vitest";
import { emailService } from "../src/services/email.service";
import { ValidationError } from "../src/utils/errors";

describe("EmailService.parseRecipientsFromCsv", () => {
  it("parses a single-column CSV with an 'email' header", () => {
    const csv = "email\njohn@gmail.com\nalice@gmail.com\nbob@gmail.com\n";
    const { recipients } = emailService.parseRecipientsFromCsv(Buffer.from(csv));
    expect(recipients).toEqual(["john@gmail.com", "alice@gmail.com", "bob@gmail.com"]);
  });

  it("auto-detects an email column among multiple columns", () => {
    const csv = "name,email,company\nJohn,john@gmail.com,Acme\nAlice,alice@gmail.com,Beta\n";
    const { recipients } = emailService.parseRecipientsFromCsv(Buffer.from(csv));
    expect(recipients).toEqual(["john@gmail.com", "alice@gmail.com"]);
  });

  it("throws a useful error on an empty CSV", () => {
    expect(() => emailService.parseRecipientsFromCsv(Buffer.from(""))).toThrow(ValidationError);
  });

  it("throws a useful error when no email column or valid addresses exist", () => {
    const csv = "name,company\nJohn,Acme\nAlice,Beta\n";
    expect(() => emailService.parseRecipientsFromCsv(Buffer.from(csv))).toThrow(ValidationError);
  });

  it("skips invalid rows but keeps valid ones, reporting invalid separately", () => {
    const csv = "email\njohn@gmail.com\nnot-an-email\nalice@gmail.com\n";
    const { recipients, invalid } = emailService.parseRecipientsFromCsv(Buffer.from(csv));
    expect(recipients).toEqual(["john@gmail.com", "alice@gmail.com"]);
    expect(invalid).toEqual(["not-an-email"]);
  });
});
