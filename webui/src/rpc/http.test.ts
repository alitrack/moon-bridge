import { afterEach, describe, expect, test, vi } from "vitest";
import {
  ApiError,
  REMEMBER_TOKEN_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  apiFetch,
  clearStoredToken,
  readStoredToken,
  saveToken
} from "./http";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

describe("apiFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  test("sends JSON requests and bearer token from session storage", async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, "session-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }));

    const result = await apiFetch<{ ok: boolean }>("/providers", {
      method: "POST",
      body: { name: "anthropic" }
    });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/providers");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer session-token",
      "Content-Type": "application/json"
    });
    expect(init?.body).toBe(JSON.stringify({ name: "anthropic" }));
  });

  test("falls back to remembered local storage token", async () => {
    localStorage.setItem(REMEMBER_TOKEN_STORAGE_KEY, "local-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/status");

    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer local-token"
    });
  });

  test("normalizes management error responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        { error: { code: "invalid_auth", message: "missing token" } },
        { status: 401 }
      )
    );

    await expect(apiFetch("/status")).rejects.toMatchObject({
      status: 401,
      code: "invalid_auth",
      message: "missing token",
      raw: { error: { code: "invalid_auth", message: "missing token" } }
    });
  });

  test("normalizes OpenAI-style error responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        {
          error: {
            type: "invalid_request_error",
            code: "bad_request",
            message: "bad request"
          }
        },
        { status: 400 }
      )
    );

    const promise = apiFetch("/responses");
    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      code: "bad_request",
      message: "bad request"
    });
  });

  test("continues when storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ ok: true }));

    await expect(apiFetch("/status")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
  });

  test("keeps a session token in memory when storage writes are blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    saveToken("volatile-token", false);

    expect(readStoredToken()).toBe("volatile-token");
  });

  test("normalizes empty error responses", async () => {
    localStorage.setItem("moonbridge.console.locale", "zh-CN");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(apiFetch("/status")).rejects.toMatchObject({
      status: 401,
      code: "request_error",
      message: "请求失败，状态码 401"
    });
  });

  test("normalizes malformed JSON error responses", async () => {
    localStorage.setItem("moonbridge.console.locale", "zh-CN");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{", {
        status: 502,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(apiFetch("/status")).rejects.toMatchObject({
      status: 502,
      code: "request_error",
      message: "请求失败，状态码 502"
    });
  });
});

describe("clearStoredToken", () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  test("removes remembered token from both stores and memory", () => {
    saveToken("remembered-token", true);
    expect(readStoredToken()).toBe("remembered-token");

    clearStoredToken();

    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(REMEMBER_TOKEN_STORAGE_KEY)).toBeNull();
    expect(readStoredToken()).toBe("");
  });

  test("clears a session-only token too", () => {
    saveToken("session-token", false);
    expect(readStoredToken()).toBe("session-token");

    clearStoredToken();

    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(readStoredToken()).toBe("");
  });
});
