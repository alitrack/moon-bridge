import type { ConfigPath } from "../../configDocs/configDescriptions";
import type { ConfigResource, FieldSchema } from "../../rpc/types";

export function configDocPathForResource(
  resource: Pick<ConfigResource, "kind" | "id">,
  field: Pick<FieldSchema, "path">
): ConfigPath | undefined {
  switch (resource.kind) {
    case "mode":
      return field.path === "mode" ? "mode" : undefined;
    case "trace":
      return topLevelPath("trace", field.path);
    case "log":
      return topLevelPath("log", field.path);
    case "server":
      return topLevelPath("server", field.path);
    case "defaults":
      return topLevelPath("defaults", field.path);
    case "web_search":
      return topLevelPath("web_search", field.path);
    case "cache":
      return topLevelPath("cache", field.path);
    case "persistence":
      return topLevelPath("persistence", field.path);
    case "proxy":
      return topLevelPath("proxy", field.path);
    case "provider":
      return providerPath(field.path);
    case "provider_offer":
      return providerOfferPath(field.path);
    case "model":
      return modelPath(field.path);
    case "route":
      return routePath(field.path);
    case "extension":
      return extensionPath(field.path);
    default:
      return undefined;
  }
}

function topLevelPath(prefix: string, fieldPath: string) {
  return `${prefix}.${fieldPath}` as ConfigPath;
}

function providerPath(fieldPath: string) {
  return `providers.<key>.${fieldPath}` as ConfigPath;
}

function providerOfferPath(fieldPath: string) {
  return `providers.<key>.offers[].${fieldPath}` as ConfigPath;
}

function modelPath(fieldPath: string) {
  return `models.<slug>.${fieldPath}` as ConfigPath;
}

function routePath(fieldPath: string) {
  return `routes.<alias>.${fieldPath}` as ConfigPath;
}

function extensionPath(fieldPath: string) {
  return `extensions.<name>.${fieldPath}` as ConfigPath;
}
