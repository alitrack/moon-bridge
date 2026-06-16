import { apiFetch } from "./http";

export type ResponseModel = {
  slug: string;
  name: string;
  provider: string;
  model?: string;
};

export type ResponseModelsResult = {
  models: ResponseModel[];
};

export type CreateResponseRequest = {
  model: string;
  input: unknown;
  max_output_tokens?: number;
  temperature?: number;
  stream?: boolean;
};

export type CreateResponseResult = {
  id: string;
  object?: string;
  status: string;
  model?: string;
  output: unknown[];
  output_text?: string;
  usage?: Record<string, unknown>;
  error?: { message: string; type?: string; code?: string; param?: string };
};

export function listResponseModels() {
  return apiFetch<ResponseModelsResult>("/v1/models");
}

export function createResponse(request: CreateResponseRequest) {
  return apiFetch<CreateResponseResult>("/v1/responses", {
    method: "POST",
    body: { ...request, stream: request.stream ?? false }
  });
}
