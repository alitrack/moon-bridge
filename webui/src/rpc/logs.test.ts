import { afterEach, describe, expect, test, vi } from "vitest";
import {
  REMEMBER_TOKEN_STORAGE_KEY,
  TOKEN_STORAGE_KEY
} from "./http";
import { createLogStream, getRecentLogs } from "./logs";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

describe("logs RPC client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  test("gets recent logs with a limit", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        {
          timestamp: "2026-06-07T00:00:00Z",
          level: "INFO",
          message: "started",
          raw: "time=2026-06-07T00:00:00Z level=INFO msg=started"
        }
      ])
    );

    const logs = await getRecentLogs({ limit: 2 });

    expect(logs).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/logs/recent?limit=2");
  });

  test("omits limit when recent logs options are empty", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse([]));

    await getRecentLogs();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/logs/recent");
  });

  test("opens log streams with bearer token from session storage", async () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, "session-token");
    const stream = new ReadableStream<Uint8Array>();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(stream, {
        headers: { "Content-Type": "text/event-stream" }
      })
    );

    const response = await createLogStream();

    expect(response.body).toBe(stream);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/logs/stream");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer session-token"
    });
  });

  test("opens log streams with remembered token when session token is absent", async () => {
    localStorage.setItem(REMEMBER_TOKEN_STORAGE_KEY, "remembered-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(new ReadableStream<Uint8Array>()));

    await createLogStream();

    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: "Bearer remembered-token"
    });
  });

  test("localizes stream fallback failures from the stored locale", async () => {
    localStorage.setItem("moonbridge.console.locale", "zh-CN");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 503 }));

    await expect(createLogStream()).rejects.toMatchObject({
      code: "log_stream_error",
      message: "日志流请求失败，状态码 503"
    });
  });

  test("localizes empty stream body failures from the stored locale", async () => {
    localStorage.setItem("moonbridge.console.locale", "zh-CN");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, {
        status: 200
      })
    );

    await expect(createLogStream()).rejects.toMatchObject({
      code: "log_stream_error",
      message: "日志流响应体为空"
    });
  });
});
