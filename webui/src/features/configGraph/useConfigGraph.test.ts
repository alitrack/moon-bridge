import { describe, expect, test } from "vitest";
import { patchRequestForField } from "./useConfigGraph";

describe("config graph hooks", () => {
  test("converts field save requests into graph patch requests", () => {
    const request = patchRequestForField({
      baseRevision: "rev-1",
      change: {
        kind: "defaults",
        id: "main",
        field: "model",
        value: "claude-sonnet"
      }
    });

    expect(request).toEqual({
      baseRevision: "rev-1",
      changes: [
        {
          kind: "defaults",
          id: "main",
          field: "model",
          value: "claude-sonnet"
        }
      ]
    });
  });
});
