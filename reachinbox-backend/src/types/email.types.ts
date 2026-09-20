export interface EmailJobData {
  emailId: string;
  tenantId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  hourlyLimit: number;
}

export interface ScheduleEmailInput {
  subject: string;
  body: string;
  startTime: string; // ISO 8601
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
  senderId: string;
  recipients: string[];
  idempotencyKey?: string;
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
}
