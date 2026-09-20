const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TOKEN_STORAGE_KEY = "reachinbox_token";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/**
 * Registered by AuthContext so the API layer can react to a 401 (clear auth state,
 * redirect to /login) without the api/ layer importing React context directly
 * (avoids a circular dependency between api/ and context/).
 */
let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.replace(/^\//, ""), API_URL.endsWith("/") ? API_URL : `${API_URL}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData; // let the browser set multipart boundary
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the server. Check your connection and try again.");
  }

  let json: any = null;
  const text = await response.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // non-JSON response (shouldn't normally happen against this API)
    }
  }

  if (!response.ok) {
    const code = json?.error?.code ?? `HTTP_${response.status}`;
    const message = json?.error?.message ?? friendlyMessageForStatus(response.status);

    if (response.status === 401) {
      clearToken();
      onUnauthorized?.();
    }

    throw new ApiError(response.status, code, message, json?.error?.details);
  }

  return (json?.data ?? json) as T;
}

function friendlyMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "That request wasn't valid. Please check the form and try again.";
    case 403:
      return "You don't have access to do that.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 409:
      return "That conflicts with something that already exists.";
    case 429:
      return "Too many requests. Please try again shortly.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export const apiClient = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", formData }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
