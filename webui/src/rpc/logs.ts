import { ApiError, apiFetch, normalizeURL, readStoredToken } from "./http";
import { translateMessage } from "../i18n/I18nProvider";
import type { LogEntry } from "./types";

export type RecentLogsOptions = {
  limit?: number;
};

export const getRecentLogs = (options: RecentLogsOptions = {}) => {
  const params = new URLSearchParams();
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  const query = params.toString();
  return apiFetch<LogEntry[]>(`/logs/recent${query ? `?${query}` : ""}`);
};

export type LogStreamOptions = {
  signal?: AbortSignal;
};

export async function createLogStream(options: LogStreamOptions = {}) {
  const headers: Record<string, string> = {
    Accept: "text/event-stream"
  };
  const token = readStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(normalizeURL("/logs/stream"), {
    method: "GET",
    headers,
    signal: options.signal
  });
  if (!response.ok) {
    throw new ApiError(
      response.status,
      "log_stream_error",
      translateMessage("logs.streamFailedWithStatus", { status: response.status })
    );
  }
  if (!response.body) {
    throw new ApiError(response.status, "log_stream_error", translateMessage("logs.streamBodyEmpty"));
  }
  return response;
}
