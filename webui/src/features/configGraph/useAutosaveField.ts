import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldError, PatchOp, PatchResponse, ResourceKind } from "../../rpc/types";

export type AutosaveFieldStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type SaveFieldRequest<T> = {
  baseRevision: string;
  change: PatchOp & { value: T };
};

export type SaveField<T> = (request: SaveFieldRequest<T>) => Promise<PatchResponse>;

export type UseAutosaveFieldOptions<T, SaveValue = T> = {
  resourceKind: ResourceKind;
  resourceId: string;
  field: string;
  committedValue: T;
  revision: string;
  save: SaveField<SaveValue>;
  disabled?: boolean;
  configUpdateFailedMessage: (result: PatchResponse["result"]) => string;
  requestFailedMessage: string;
};

export type AutosaveFieldState<T, SaveValue = T> = {
  value: T;
  status: AutosaveFieldStatus;
  error?: FieldError;
  setValue: (value: T) => void;
  commit: () => void;
  commitValue: (value: T) => void;
  commitSerializedValue: (localValue: T, saveValue: SaveValue) => void;
  reset: () => void;
};

export function useAutosaveField<T, SaveValue = T>({
  resourceKind,
  resourceId,
  field,
  committedValue,
  revision,
  save,
  disabled = false,
  configUpdateFailedMessage,
  requestFailedMessage
}: UseAutosaveFieldOptions<T, SaveValue>): AutosaveFieldState<T, SaveValue> {
  const [value, setValueState] = useState<T>(committedValue);
  const [status, setStatus] = useState<AutosaveFieldStatus>("idle");
  const [error, setError] = useState<FieldError | undefined>();
  const saveSeq = useRef(0);
  const committedRef = useRef(committedValue);
  const valueRef = useRef(value);
  const statusRef = useRef(status);
  const revisionRef = useRef(revision);

  valueRef.current = value;
  statusRef.current = status;

  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);

  // Adopt values committed elsewhere (e.g. another field saved and refreshed
  // the graph) without discarding an edit the user is in the middle of typing.
  useEffect(() => {
    if (valuesEqual(committedValue, committedRef.current)) {
      return;
    }
    committedRef.current = committedValue;
    if (statusRef.current === "dirty" || statusRef.current === "saving") {
      return;
    }
    setValueState(committedValue);
    setError(undefined);
    setStatus("idle");
  }, [committedValue]);

  const runSave = useCallback(
    (pendingValue: T, saveValue: SaveValue) => {
      if (disabled) {
        return;
      }
      const sequence = ++saveSeq.current;
      setStatus("saving");
      setError(undefined);

      save({
        baseRevision: revisionRef.current,
        change: {
          kind: resourceKind,
          id: resourceId,
          field,
          value: saveValue
        }
      })
        .then((response) => {
          if (sequence !== saveSeq.current) {
            return;
          }
          applySaveResponse(response, pendingValue);
        })
        .catch((cause: unknown) => {
          if (sequence !== saveSeq.current) {
            return;
          }
          setError({
            resourceKind,
            resourceId,
            field,
            code: "requestFailed",
            message: cause instanceof Error ? cause.message : requestFailedMessage
          });
          setStatus("error");
        });
    },
    [disabled, field, requestFailedMessage, resourceId, resourceKind, save]
  );

  const setValue = useCallback((next: T) => {
    setValueState(next);
    setError(undefined);
    setStatus(valuesEqual(next, committedRef.current) ? "idle" : "dirty");
  }, []);

  // Commit the current value (used when an input loses focus).
  const commit = useCallback(() => {
    if (statusRef.current !== "dirty") {
      return;
    }
    runSave(valueRef.current, valueRef.current as unknown as SaveValue);
  }, [runSave]);

  // Set and immediately persist (used by discrete controls like switches/menus).
  const commitValue = useCallback(
    (next: T) => {
      setValueState(next);
      if (valuesEqual(next, committedRef.current)) {
        setError(undefined);
        setStatus("idle");
        return;
      }
      runSave(next, next as unknown as SaveValue);
    },
    [runSave]
  );

  // Persist a different wire value while keeping the local UI value typed.
  const commitSerializedValue = useCallback(
    (next: T, serialized: SaveValue) => {
      setValueState(next);
      if (valuesEqual(next, committedRef.current)) {
        setError(undefined);
        setStatus("idle");
        return;
      }
      runSave(next, serialized);
    },
    [runSave]
  );

  const reset = useCallback(() => {
    setValueState(committedRef.current);
    setError(undefined);
    setStatus("idle");
  }, []);

  return { value, status, error, setValue, commit, commitValue, commitSerializedValue, reset };

  function applySaveResponse(response: PatchResponse, pendingValue: T) {
    const fieldError = findFieldError(response.errors, resourceKind, resourceId, field);
    switch (response.result) {
      case "committed":
      case "restartRequired":
        revisionRef.current = response.revision;
        committedRef.current = pendingValue;
        setError(undefined);
        if (!valuesEqual(valueRef.current, pendingValue)) {
          setStatus("dirty");
          return;
        }
        setStatus("saved");
        return;
      case "draftRejected":
      case "validationRejected":
      case "revisionConflict":
        setError(fieldError ?? genericPatchError(response, resourceKind, resourceId, field, configUpdateFailedMessage));
        setStatus("error");
        return;
      case "runtimeRejected": {
        const rollback = response.rollbackValue === undefined
          ? committedRef.current
          : response.rollbackValue as T;
        setValueState(rollback);
        setError(fieldError ?? genericPatchError(response, resourceKind, resourceId, field, configUpdateFailedMessage));
        setStatus("error");
        return;
      }
      default:
        setError(genericPatchError(response, resourceKind, resourceId, field, configUpdateFailedMessage));
        setStatus("error");
    }
  }
}

function findFieldError(
  errors: FieldError[] | undefined,
  resourceKind: ResourceKind,
  resourceId: string,
  field: string
) {
  return errors?.find((error) =>
    (error.resourceKind === resourceKind || error.resourceKind === "") &&
    (error.resourceId === resourceId || error.resourceId === "") &&
    (!error.field || error.field === field)
  ) ?? errors?.[0];
}

function genericPatchError(
  response: PatchResponse,
  resourceKind: ResourceKind,
  resourceId: string,
  field: string,
  message: (result: PatchResponse["result"]) => string
): FieldError {
  return {
    resourceKind,
    resourceId,
    field,
    code: response.result,
    message: message(response.result)
  };
}

function valuesEqual(left: unknown, right: unknown) {
  if (Object.is(left, right)) {
    return true;
  }
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
}
