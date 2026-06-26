import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createConfigResource,
  deleteConfigResource,
  getConfigGraph,
  patchConfigGraph,
  validateConfigGraph
} from "../../rpc/configGraph";
import { queryKeys } from "../../rpc/queryKeys";
import type {
  CreateConfigResourceRequest,
  PatchRequest,
  PatchResponse,
  ResourceKind
} from "../../rpc/types";
import type { SaveFieldRequest } from "./useAutosaveField";

export function useConfigGraph() {
  return useQuery({
    queryKey: queryKeys.configGraph,
    queryFn: getConfigGraph
  });
}

export function usePatchConfigGraph() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: PatchRequest) => patchConfigGraph(request),
    onSuccess: (response) => updateGraphCache(queryClient, response)
  });
}

export function useValidateConfigGraph() {
  return useMutation({
    mutationFn: (request: PatchRequest) => validateConfigGraph(request)
  });
}

export function useCreateConfigResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, body }: { kind: ResourceKind; body: CreateConfigResourceRequest }) =>
      createConfigResource(kind, body),
    onSuccess: (response) => updateGraphCache(queryClient, response)
  });
}

export function useDeleteConfigResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      id,
      baseRevision
    }: {
      kind: ResourceKind;
      id: string;
      baseRevision: string;
    }) => deleteConfigResource(kind, id, baseRevision),
    onSuccess: (response) => updateGraphCache(queryClient, response)
  });
}

export function useGraphFieldSaver<T>() {
  const patch = usePatchConfigGraph();
  return (request: SaveFieldRequest<T>) =>
    patch.mutateAsync({
      baseRevision: request.baseRevision,
      changes: [request.change]
    });
}

function updateGraphCache(
  queryClient: ReturnType<typeof useQueryClient>,
  response: PatchResponse
) {
  if (response.graph) {
    queryClient.setQueryData(queryKeys.configGraph, response.graph);
    return;
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.configGraph });
}

export function patchRequestForField<T>(request: SaveFieldRequest<T>): PatchRequest {
  return {
    baseRevision: request.baseRevision,
    changes: [request.change]
  };
}
