import axios, { type AxiosError } from "axios";
import { API_URL } from "@/lib/constants";

// ─── Axios instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ─── Request interceptor — attach JWT ─────────────────────────────────────────

api.interceptors.request.use((config) => {
  // Read token from localStorage (set by auth store)
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — global error handling ────────────────────────────

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; errors?: unknown }>) => {
    const status = error.response?.status;

    // 401 — token expired or invalid → clear auth and redirect to login
    if (status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      // Let the auth store handle the redirect via its subscriber
      window.dispatchEvent(new Event("auth:logout"));
    }

    return Promise.reject(error);
  }
);

// ─── Typed API response helper ────────────────────────────────────────────────

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
};

export type ApiError = {
  message: string;
  errors?: Record<string, string[]>;
};

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as ApiError)?.message ??
      error.message ??
      "An unexpected error occurred"
    );
  }
  return "An unexpected error occurred";
}
