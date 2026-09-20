import { apiClient } from "./client";
import {
  Email,
  PaginatedResult,
  ScheduleEmailInput,
  ScheduleEmailCsvInput,
  ScheduleResult,
  EmailSearchResult,
} from "../types/email.types";

export function scheduleEmails(input: ScheduleEmailInput): Promise<ScheduleResult> {
  return apiClient.post<ScheduleResult>("/api/emails/schedule", input);
}

export function scheduleEmailsFromCsv(input: ScheduleEmailCsvInput): Promise<ScheduleResult> {
  const form = new FormData();
  form.append("subject", input.subject);
  form.append("body", input.body);
  form.append("startTime", input.startTime);
  form.append("delayBetweenEmailsMs", String(input.delayBetweenEmailsMs));
  form.append("hourlyLimit", String(input.hourlyLimit));
  form.append("senderId", input.senderId);
  form.append("file", input.file);
  return apiClient.postForm<ScheduleResult>("/api/emails/schedule/csv", form);
}

export function getScheduledEmails(page = 1, limit = 20): Promise<PaginatedResult<Email>> {
  return apiClient.get<PaginatedResult<Email>>("/api/emails/scheduled", { page, limit });
}

export function getSentEmails(page = 1, limit = 20): Promise<PaginatedResult<Email>> {
  return apiClient.get<PaginatedResult<Email>>("/api/emails/sent", { page, limit });
}

export function getEmailById(id: string): Promise<Email> {
  return apiClient.get<Email>(`/api/emails/${id}`);
}

export function cancelEmail(id: string): Promise<{ id: string; status: string }> {
  return apiClient.delete(`/api/emails/${id}`);
}

export function searchEmails(q: string, page = 1, limit = 20, status?: string): Promise<EmailSearchResult> {
  return apiClient.get<EmailSearchResult>("/api/emails/search", { q, page, limit, status });
}
