import { apiFetch } from "./http";
import type {
  ApplyResult,
  ChangeRow,
  DefaultsSettings,
  ImportResult,
  ModelDetail,
  ModelSummary,
  ModelUpsert,
  MutationAccepted,
  Paginated,
  ProviderDetail,
  ProviderSummary,
  ProviderUpsert,
  RouteDetail,
  RouteSummary,
  RouteUpsert,
  SessionInfo,
  StatsSummary,
  StatusResponse,
  UsageStats,
  ValidationResult,
  WebSearchSettings
} from "./types";

type Page = {
  limit?: number;
  offset?: number;
};

function pageQuery(page: Page = {}) {
  const params = new URLSearchParams();
  if (page.limit !== undefined) {
    params.set("limit", String(page.limit));
  }
  if (page.offset !== undefined) {
    params.set("offset", String(page.offset));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const getStatus = () => apiFetch<StatusResponse>("/status");

export const listProviders = (page?: Page) =>
  apiFetch<Paginated<ProviderSummary>>(`/providers${pageQuery(page)}`);
export const getProvider = (key: string) => apiFetch<ProviderDetail>(`/providers/${encodeURIComponent(key)}`);
export const putProvider = (key: string, body: ProviderUpsert) =>
  apiFetch<MutationAccepted>(`/providers/${encodeURIComponent(key)}`, { method: "PUT", body });
export const patchProvider = (key: string, body: Partial<ProviderUpsert>) =>
  apiFetch<MutationAccepted>(`/providers/${encodeURIComponent(key)}`, { method: "PATCH", body });
export const deleteProvider = (key: string) =>
  apiFetch<MutationAccepted>(`/providers/${encodeURIComponent(key)}`, { method: "DELETE" });
export const testProvider = (key: string) =>
  apiFetch<Record<string, unknown>>(`/providers/${encodeURIComponent(key)}/test`, { method: "POST" });

export const createOffer = (providerKey: string, body: Record<string, unknown>) =>
  apiFetch<MutationAccepted>(`/providers/${encodeURIComponent(providerKey)}/offers`, {
    method: "POST",
    body
  });
export const updateOffer = (providerKey: string, model: string, body: Record<string, unknown>) =>
  apiFetch<MutationAccepted>(
    `/providers/${encodeURIComponent(providerKey)}/offers/${encodeURIComponent(model)}`,
    { method: "PATCH", body }
  );
export const deleteOffer = (providerKey: string, model: string) =>
  apiFetch<MutationAccepted>(
    `/providers/${encodeURIComponent(providerKey)}/offers/${encodeURIComponent(model)}`,
    { method: "DELETE" }
  );

export const listModels = (page?: Page) =>
  apiFetch<Paginated<ModelSummary>>(`/models${pageQuery(page)}`);
export const getModel = (slug: string) => apiFetch<ModelDetail>(`/models/${encodeURIComponent(slug)}`);
export const putModel = (slug: string, body: ModelUpsert) =>
  apiFetch<MutationAccepted>(`/models/${encodeURIComponent(slug)}`, { method: "PUT", body });
export const deleteModel = (slug: string) =>
  apiFetch<MutationAccepted>(`/models/${encodeURIComponent(slug)}`, { method: "DELETE" });

export const listRoutes = (page?: Page) =>
  apiFetch<Paginated<RouteSummary>>(`/routes${pageQuery(page)}`);
export const getRoute = (alias: string) => apiFetch<RouteDetail>(`/routes/${encodeURIComponent(alias)}`);
export const putRoute = (alias: string, body: RouteUpsert) =>
  apiFetch<MutationAccepted>(`/routes/${encodeURIComponent(alias)}`, { method: "PUT", body });
export const deleteRoute = (alias: string) =>
  apiFetch<MutationAccepted>(`/routes/${encodeURIComponent(alias)}`, { method: "DELETE" });

export const getChanges = () => apiFetch<ChangeRow[]>("/changes");
export const applyChanges = () => apiFetch<ApplyResult>("/changes/apply", { method: "POST" });
export const discardChanges = () => apiFetch<ApplyResult>("/changes/discard", { method: "POST" });

export const getEffectiveConfig = () => apiFetch<Record<string, unknown>>("/config/effective");
export const validateConfig = (config: string) =>
  apiFetch<ValidationResult>("/config/validate", { method: "POST", body: { config } });
export const importConfig = (yaml: string) =>
  apiFetch<ImportResult>("/config/import", { method: "POST", body: { yaml } });
export const exportConfig = ({ includeSecrets = false }: { includeSecrets?: boolean } = {}) =>
  apiFetch<string>(`/config/export?include_secrets=${includeSecrets ? "true" : "false"}`, {
    headers: includeSecrets ? { "X-Confirm-Secrets": "true" } : undefined
  });

export const getDefaults = () => apiFetch<DefaultsSettings>("/defaults");
export const putDefaults = (body: DefaultsSettings) =>
  apiFetch<MutationAccepted>("/defaults", { method: "PUT", body });

export const getWebSearch = () => apiFetch<WebSearchSettings>("/web-search");
export const putWebSearch = (body: WebSearchSettings) =>
  apiFetch<MutationAccepted>("/web-search", { method: "PUT", body });

export const listExtensions = () => apiFetch<string[]>("/extensions");
export const getExtension = (name: string) =>
  apiFetch<Record<string, unknown>>(`/extensions/${encodeURIComponent(name)}`);
export const putExtension = (name: string, body: Record<string, unknown>) =>
  apiFetch<MutationAccepted>(`/extensions/${encodeURIComponent(name)}`, { method: "PUT", body });

export const getStatsSummary = () => apiFetch<StatsSummary>("/stats/summary");

export type UsageRange = "session" | "24h" | "7d" | "30d" | "all";
export const getUsageStats = (range: UsageRange = "session") =>
  apiFetch<UsageStats>(range === "session" ? "/stats/usage" : `/stats/usage?range=${range}`);
export const getSessions = () => apiFetch<SessionInfo[]>("/sessions");
