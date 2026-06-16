import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PatchResponse } from "../../rpc/types";
import { useAutosaveField, type SaveField } from "./useAutosaveField";

const committed = (revision = "rev-2"): PatchResponse => ({
  result: "committed",
  revision
});

describe("useAutosaveField", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("marks the field dirty as soon as local value changes", () => {
    const save: SaveField<string> = vi.fn();
    const { result } = renderHook(() =>
      useAutosaveField({
        resourceKind: "defaults",
        resourceId: "main",
        field: "model",
        committedValue: "claude-3-5-sonnet",
        revision: "rev-1",
        save,
        configUpdateFailedMessage,
        requestFailedMessage
      })
    );

    act(() => result.current.setValue("claude-3-7-sonnet"));

    expect(result.current.value).toBe("claude-3-7-sonnet");
    expect(result.current.status).toBe("dirty");
    expect(save).not.toHaveBeenCalled();
  });

  test("persists the dirty value on commit and clears the dirty state", async () => {
    const save: SaveField<string> = vi.fn().mockResolvedValue(committed());
    const { result } = renderHook(() =>
      useAutosaveField({
        resourceKind: "defaults",
        resourceId: "main",
        field: "model",
        committedValue: "old-model",
        revision: "rev-1",
        save,
        configUpdateFailedMessage,
        requestFailedMessage
      })
    );

    act(() => result.current.setValue("new-model"));
    expect(save).not.toHaveBeenCalled();

    act(() => result.current.commit());
    expect(save).toHaveBeenCalledWith({
      baseRevision: "rev-1",
      change: {
        kind: "defaults",
        id: "main",
        field: "model",
        value: "new-model"
      }
    });
    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(result.current.error).toBeUndefined();
  });

  test("keeps a newer dirty value when an earlier save commits", async () => {
    const firstSave = deferred<PatchResponse>();
    const save: SaveField<string> = vi.fn()
      .mockReturnValueOnce(firstSave.promise)
      .mockResolvedValue(committed("rev-3"));
    const { result } = renderHook(() =>
      useAutosaveField({
        resourceKind: "provider",
        resourceId: "anthropic",
        field: "api_key",
        committedValue: "masked",
        revision: "rev-1",
        save,
        configUpdateFailedMessage,
        requestFailedMessage
      })
    );

    act(() => result.current.setValue("secret-a"));
    act(() => result.current.commit());

    expect(result.current.status).toBe("saving");
    expect(save).toHaveBeenCalledWith({
      baseRevision: "rev-1",
      change: {
        kind: "provider",
        id: "anthropic",
        field: "api_key",
        value: "secret-a"
      }
    });

    act(() => result.current.setValue("secret-b"));

    expect(result.current.value).toBe("secret-b");
    expect(result.current.status).toBe("dirty");

    await act(async () => {
      firstSave.resolve(committed("rev-2"));
      await firstSave.promise;
    });

    expect(result.current.value).toBe("secret-b");
    expect(result.current.status).toBe("dirty");

    act(() => result.current.commit());

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({
      baseRevision: "rev-2",
      change: {
        kind: "provider",
        id: "anthropic",
        field: "api_key",
        value: "secret-b"
      }
    });
    await waitFor(() => expect(result.current.status).toBe("saved"));
  });

  test("commit is a no-op when the field is not dirty", () => {
    const save: SaveField<string> = vi.fn().mockResolvedValue(committed());
    const { result } = renderHook(() =>
      useAutosaveField({
        resourceKind: "defaults",
        resourceId: "main",
        field: "model",
        committedValue: "old-model",
        revision: "rev-1",
        save,
        configUpdateFailedMessage,
        requestFailedMessage
      })
    );

    act(() => result.current.commit());

    expect(save).not.toHaveBeenCalled();
  });

  test("commitValue persists immediately for discrete controls", async () => {
    const save: SaveField<boolean> = vi.fn().mockResolvedValue(committed());
    const { result } = renderHook(() =>
      useAutosaveField({
        resourceKind: "provider",
        resourceId: "anthropic",
        field: "enabled",
        committedValue: false,
        revision: "rev-1",
        save,
        configUpdateFailedMessage,
        requestFailedMessage
      })
    );

    act(() => result.current.commitValue(true));

    expect(save).toHaveBeenCalledWith({
      baseRevision: "rev-1",
      change: {
        kind: "provider",
        id: "anthropic",
        field: "enabled",
        value: true
      }
    });
    await waitFor(() => expect(result.current.status).toBe("saved"));
  });

  test("keeps draft value and field error after draft rejection", async () => {
    const save: SaveField<number> = vi.fn().mockResolvedValue({
      result: "draftRejected",
      revision: "rev-1",
      errors: [
        {
          resourceKind: "defaults",
          resourceId: "main",
          field: "max_tokens",
          code: "invalidValue",
          message: "must be positive"
        }
      ]
    } satisfies PatchResponse);
    const { result } = renderHook(() =>
      useAutosaveField({
        resourceKind: "defaults",
        resourceId: "main",
        field: "max_tokens",
        committedValue: 1024,
        revision: "rev-1",
        save,
        configUpdateFailedMessage,
        requestFailedMessage
      })
    );

    act(() => result.current.setValue(-1));
    act(() => result.current.commit());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.value).toBe(-1);
    expect(result.current.error?.message).toBe("must be positive");
  });

  test("uses the localized generic message when rejected patches do not include field errors", async () => {
    const save: SaveField<number> = vi.fn().mockResolvedValue({
      result: "validationRejected",
      revision: "rev-1"
    } satisfies PatchResponse);
    const { result } = renderHook(() =>
      useAutosaveField({
        resourceKind: "defaults",
        resourceId: "main",
        field: "max_tokens",
        committedValue: 1024,
        revision: "rev-1",
        save,
        configUpdateFailedMessage,
        requestFailedMessage
      })
    );

    act(() => result.current.setValue(-1));
    act(() => result.current.commit());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toBe("Config update validationRejected failed.");
  });

  test("rolls back to the server value after runtime rejection", async () => {
    const save: SaveField<string> = vi.fn().mockResolvedValue({
      result: "runtimeRejected",
      revision: "rev-2",
      rollbackValue: "old-address",
      errors: [
        {
          resourceKind: "server",
          resourceId: "main",
          field: "addr",
          code: "runtimeReloadRejected",
          message: "address already in use"
        }
      ]
    } satisfies PatchResponse);
    const { result } = renderHook(() =>
      useAutosaveField({
        resourceKind: "server",
        resourceId: "main",
        field: "addr",
        committedValue: "old-address",
        revision: "rev-1",
        save,
        configUpdateFailedMessage,
        requestFailedMessage
      })
    );

    act(() => result.current.setValue("bad-address"));
    act(() => result.current.commit());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.value).toBe("old-address");
    expect(result.current.error?.message).toBe("address already in use");
  });

  test("does not discard an in-progress edit when the committed value refreshes", () => {
    const save: SaveField<string> = vi.fn();
    const { result, rerender } = renderHook(
      ({ committedValue, revision }) =>
        useAutosaveField({
          resourceKind: "defaults",
          resourceId: "main",
          field: "model",
          committedValue,
          revision,
          save,
          configUpdateFailedMessage,
          requestFailedMessage
        }),
      { initialProps: { committedValue: "original", revision: "rev-1" } }
    );

    act(() => result.current.setValue("user-typing"));
    expect(result.current.status).toBe("dirty");

    // Another field commits, refreshing the graph with a new revision.
    rerender({ committedValue: "original", revision: "rev-2" });

    expect(result.current.value).toBe("user-typing");
    expect(result.current.status).toBe("dirty");
  });
});

const requestFailedMessage = "Request failed";
const configUpdateFailedMessage = (result: PatchResponse["result"]) => `Config update ${result} failed.`;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}
