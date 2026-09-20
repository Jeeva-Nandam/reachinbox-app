export type EmailStatus =
  | "scheduled"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled"
  | "rate_limited";

export interface Email {
  id: string;
  tenantId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  messageId: string | null;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: T[];
}

export interface Sender {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSenderInput {
  email: string;
  displayName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser: string;
  smtpPassword: string;
}

export interface ScheduleEmailInput {
  subject: string;
  body: string;
  startTime: string; // ISO 8601
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  senderId: string;
  recipients: string[];
  idempotencyKey?: string;
}

export interface ScheduleEmailCsvInput {
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  senderId: string;
  file: File;
}

export interface ScheduleResult {
  batchKey: string;
  totalRequested: number;
  duplicatesSkipped: number;
  created: {
    id: string;
    recipient: string;
    scheduledAt: string;
    status: string;
  }[];
  invalidRowsSkipped?: string[];
}

export interface EmailSearchHit {
  id: string;
  recipient: string;
  subject: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}

export interface EmailSearchResult {
  query: string;
  page: number;
  limit: number;
  total: number;
  results: EmailSearchHit[];
}
