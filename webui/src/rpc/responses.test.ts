import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError } from "./http";
import { createResponse, listResponseModels } from "./responses";

describe("responses RPC client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("lists models from /v1/models", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ models: [{ slug: "moonbridge", name: "Moon Bridge", provider: "route" }] }), {
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(listResponseModels()).resolves.toEqual({
      models: [{ slug: "moonbridge", name: "Moon Bridge", provider: "route" }]
    });
    expect(fetchMock.mock.calls[0][0]).toBe("/v1/models");
  });

  test("posts a non-streaming response request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "resp_1", status: "completed", output_text: "ok", output: [] }), {
        headers: { "Content-Type": "application/json" }
      })
    );

    await createResponse({ model: "moonbridge", input: "ping" });

    expect(fetchMock.mock.calls[0][0]).toBe("/v1/responses");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ model: "moonbridge", input: "ping", stream: false })
    });
  });

  test("normalizes OpenAI-style errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "bad_request", message: "bad request" } }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    );

    await expect(createResponse({ model: "missing", input: "ping" })).rejects.toBeInstanceOf(ApiError);
  });
});
