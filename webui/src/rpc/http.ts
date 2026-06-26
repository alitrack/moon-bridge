import { translateMessage } from "../i18n/I18nProvider";

export const API_BASE = "/api/v1";
export const TOKEN_STORAGE_KEY = "moonbridge.console.token";
export const REMEMBER_TOKEN_STORAGE_KEY = "moonbridge.console.rememberedToken";

let volatileToken = "";

export type ApiFetchOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: HeadersInit;
  rawBody?: BodyInit | null;
};

export class ApiError extends Error {
  status: number;
  code: string;
  raw: unknown;

  constructor(status: number, code: string, message: string, raw?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.raw = raw;
  }
}

export function isAuthError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401;
}

export function readStoredToken(): string {
  const sessionToken = safeGetStorage(getStorage("sessionStorage"), TOKEN_STORAGE_KEY);
  if (sessionToken) {
    return sessionToken;
  }
  return safeGetStorage(getStorage("localStorage"), REMEMBER_TOKEN_STORAGE_KEY) ?? volatileToken;
}

export function saveToken(token: string, remember: boolean) {
  volatileToken = token;
  safeSetStorage(getStorage("sessionStorage"), TOKEN_STORAGE_KEY, token);
  if (remember) {
    safeSetStorage(getStorage("localStorage"), REMEMBER_TOKEN_STORAGE_KEY, token);
  } else {
    safeRemoveStorage(getStorage("localStorage"), REMEMBER_TOKEN_STORAGE_KEY);
  }
}

export function clearStoredToken() {
  volatileToken = "";
  safeRemoveStorage(getStorage("sessionStorage"), TOKEN_STORAGE_KEY);
  safeRemoveStorage(getStorage("localStorage"), REMEMBER_TOKEN_STORAGE_KEY);
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const url = normalizeURL(path);
  const headers = headersToRecord(options.headers);
  const token = readStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body: BodyInit | null | undefined = options.rawBody;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body
  });

  const payload = await readPayload(response);
  if (!response.ok) {
    throw normalizeError(response.status, payload);
  }
  return payload as T;
}

export function normalizeURL(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  if (
    path.startsWith("/api/v1/") ||
    path === "/api/v1" ||
    path.startsWith("/v1/") ||
    path === "/v1"
  ) {
    return path;
  }
  if (path.startsWith("/")) {
    return `${API_BASE}${path}`;
  }
  return `${API_BASE}/${path}`;
}

async function readPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function normalizeError(status: number, raw: unknown): ApiError {
  if (isObject(raw) && isObject(raw.error)) {
    const code = stringValue(raw.error.code) ?? stringValue(raw.error.type) ?? "request_error";
    const message = stringValue(raw.error.message) ?? translateMessage("error.requestFailedWithStatus", { status });
    return new ApiError(status, code, message, raw);
  }
  return new ApiError(status, "request_error", translateMessage("error.requestFailedWithStatus", { status }), raw);
}

function safeGetStorage(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function getStorage(name: "sessionStorage" | "localStorage"): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  try {
    return window[name];
  } catch {
    return undefined;
  }
}

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

function safeSetStorage(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage may be disabled in hardened browser contexts.
  }
}

function safeRemoveStorage(storage: Storage | undefined, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage may be disabled in hardened browser contexts.
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
