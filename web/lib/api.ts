import axios, { type AxiosError } from "axios";
import { API_URL } from "@/lib/constants";

// ─── Axios instance ───────────────────────────────────────────────────────────

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// ─── Token resolver ───────────────────────────────────────────────────────────

/**
 * Reads the access token from the Zustand persisted store in localStorage.
 *
 * Zustand persist stores state under the key "auth-storage" as:
 *   { state: { accessToken: "..." }, version: 0 }
 *
 * We read directly from there so the token survives page refreshes
 * without needing a separate localStorage.setItem("access_token") call.
 */
function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("auth-storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

// ─── Request interceptor — attach JWT ─────────────────────────────────────────

api.interceptors.request.use((config) => {
  const token = getAccessToken();
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

    if (status === 401 && typeof window !== "undefined") {
      // Clear persisted auth state
      localStorage.removeItem("auth-storage");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      document.cookie = "access_token=; path=/; max-age=0";
      window.dispatchEvent(new Event("auth:logout"));
    }

    return Promise.reject(error);
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

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
