import { apiFetch } from "./http";
import type {
  ConfigGraph,
  CreateConfigResourceRequest,
  PatchRequest,
  PatchResponse,
  ResourceKind
} from "./types";

export const getConfigGraph = () => apiFetch<ConfigGraph>("/config/graph");

export const patchConfigGraph = (body: PatchRequest) =>
  apiFetch<PatchResponse>("/config/graph", { method: "PATCH", body });

export const validateConfigGraph = (body: PatchRequest) =>
  apiFetch<PatchResponse>("/config/graph/validate", { method: "POST", body });

export const createConfigResource = (
  kind: ResourceKind,
  body: CreateConfigResourceRequest
) =>
  apiFetch<PatchResponse>(`/config/resources/${encodeURIComponent(kind)}`, {
    method: "POST",
    body: {
      ...body,
      value: body.value ?? {}
    }
  });

export const deleteConfigResource = (
  kind: ResourceKind,
  id: string,
  baseRevision: string
) =>
  apiFetch<PatchResponse>(
    `/config/resources/${encodeURIComponent(kind)}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      body: { baseRevision }
    }
  );
