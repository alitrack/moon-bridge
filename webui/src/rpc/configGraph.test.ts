import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createConfigResource,
  deleteConfigResource,
  getConfigGraph,
  patchConfigGraph,
  validateConfigGraph
} from "./configGraph";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

describe("config graph RPC client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  test("gets the current config graph", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        revision: "rev-1",
        resources: [],
        validation: { valid: true },
        runtime: { status: "ready" },
        capabilities: { autosave: true, logs: true }
      })
    );

    const graph = await getConfigGraph();

    expect(graph.revision).toBe("rev-1");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/config/graph");
    expect(fetchMock.mock.calls[0][1]?.method).toBeUndefined();
  });

  test("patches graph fields with a base revision", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ result: "committed", revision: "rev-2" })
    );

    await patchConfigGraph({
      baseRevision: "rev-1",
      changes: [
        {
          kind: "provider",
          id: "anthropic",
          field: "base_url",
          value: "https://api.anthropic.com"
        }
      ]
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/config/graph");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "PATCH",
      body: JSON.stringify({
        baseRevision: "rev-1",
        changes: [
          {
            kind: "provider",
            id: "anthropic",
            field: "base_url",
            value: "https://api.anthropic.com"
          }
        ]
      })
    });
  });

  test("validates graph patches without committing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ result: "committed", revision: "rev-1" })
    );

    await validateConfigGraph({
      baseRevision: "rev-1",
      changes: [{ kind: "defaults", id: "main", field: "max_tokens", value: 2048 }]
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/config/graph/validate");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST"
    });
  });

  test("creates resources with an explicit base revision", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ result: "committed", revision: "rev-2" })
    );

    await createConfigResource("model", {
      id: "claude-sonnet",
      baseRevision: "rev-1",
      value: {
        display_name: "Claude Sonnet",
        context_window: 200000
      }
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/config/resources/model");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        id: "claude-sonnet",
        baseRevision: "rev-1",
        value: {
          display_name: "Claude Sonnet",
          context_window: 200000
        }
      })
    });
  });

  test("deletes resources with base revision in the request body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ result: "committed", revision: "rev-2" })
    );

    await deleteConfigResource("route", "primary", "rev-1");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/config/resources/route/primary");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "DELETE",
      body: JSON.stringify({ baseRevision: "rev-1" })
    });
  });

  test("encodes resource identifiers in URLs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ result: "committed", revision: "rev-2" })
    );

    await deleteConfigResource("provider_offer", "openai/gpt-4.1", "rev-1");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/config/resources/provider_offer/openai%2Fgpt-4.1"
    );
  });
});
