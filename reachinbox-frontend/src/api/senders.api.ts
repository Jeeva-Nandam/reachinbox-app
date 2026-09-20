import { apiClient } from "./client";
import { Sender, CreateSenderInput } from "../types/email.types";

export function getSenders(): Promise<Sender[]> {
  return apiClient.get<Sender[]>("/api/emails/senders");
}

export function createSender(input: CreateSenderInput): Promise<Sender> {
  return apiClient.post<Sender>("/api/emails/senders", input);
}

export function deleteSender(id: string): Promise<{ id: string; deleted: boolean }> {
  return apiClient.delete(`/api/emails/senders/${id}`);
}
