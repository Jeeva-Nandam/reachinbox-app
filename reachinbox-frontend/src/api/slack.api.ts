import { apiClient } from "./client";
import { SlackStatus } from "../types/slack.types";

export function getSlackStatus(): Promise<SlackStatus> {
  return apiClient.get<SlackStatus>("/api/slack/status");
}

export async function connectSlack(): Promise<void> {
  const { authorizeUrl } = await apiClient.get<{ authorizeUrl: string }>("/api/slack/connect");
  window.location.href = authorizeUrl;
}

export function disconnectSlack(): Promise<{ connected: boolean }> {
  return apiClient.post<{ connected: boolean }>("/api/slack/disconnect");
}
