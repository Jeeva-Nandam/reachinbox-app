import { apiClient } from "./client";
import { User } from "../types/auth.types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/** Not a fetch call — navigates the browser into the backend's real OAuth flow. */
export function googleLoginUrl(): string {
  return `${API_URL}/api/auth/google`;
}

export function getCurrentUser(): Promise<User> {
  return apiClient.get<User>("/api/auth/me");
}

export function devLogin(): Promise<{ token: string; user: { id: string; email: string; tenantId: string } }> {
  return apiClient.post("/api/auth/dev-login");
}
