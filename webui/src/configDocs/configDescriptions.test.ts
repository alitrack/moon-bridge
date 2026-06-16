import { describe, expect, test } from "vitest";
import { configDescriptions, requiredConfigPaths } from "./configDescriptions";

describe("configDescriptions", () => {
  test("documents all required first-pass config paths in both languages", () => {
    for (const path of requiredConfigPaths) {
      const entry = configDescriptions[path];

      expect(entry, path).toBeDefined();
      expect(entry.title["en-US"], path).toBeTruthy();
      expect(entry.title["zh-CN"], path).toBeTruthy();
      expect(entry.description["en-US"], path).toBeTruthy();
      expect(entry.description["zh-CN"], path).toBeTruthy();
    }
  });

  test("marks secret-bearing fields as sensitive", () => {
    expect(configDescriptions["server.auth_token"].sensitive).toBe(true);
    expect(configDescriptions["providers.<key>.api_key"].sensitive).toBe(true);
    expect(configDescriptions["web_search.tavily_api_key"].sensitive).toBe(true);
    expect(configDescriptions["web_search.firecrawl_api_key"].sensitive).toBe(true);
  });

  test("covers backend schema fields rendered by the resource editor", () => {
    const expectedPaths = [
      "trace.enabled",
      "log.level",
      "log.format",
      "server.max_sessions",
      "server.session_ttl",
      "models.<slug>.display_name",
      "models.<slug>.description",
      "models.<slug>.base_instructions",
      "models.<slug>.supports_reasoning",
      "models.<slug>.default_reasoning_level",
      "models.<slug>.supported_reasoning_levels",
      "models.<slug>.supports_reasoning_summaries",
      "models.<slug>.default_reasoning_summary",
      "models.<slug>.input_modalities",
      "models.<slug>.supports_image_detail_original",
      "models.<slug>.web_search",
      "models.<slug>.extensions",
      "providers.<key>.web_search",
      "providers.<key>.extensions",
      "providers.<key>.offers[].priority",
      "providers.<key>.offers[].overrides",
      "routes.<alias>.to",
      "routes.<alias>.display_name",
      "routes.<alias>.description",
      "routes.<alias>.context_window",
      "routes.<alias>.web_search",
      "routes.<alias>.extensions",
      "cache.ttl",
      "cache.prompt_caching",
      "cache.automatic_prompt_cache",
      "cache.explicit_cache_breakpoints",
      "cache.allow_retention_downgrade",
      "cache.max_breakpoints",
      "cache.min_cache_tokens",
      "cache.expected_reuse",
      "cache.minimum_value_score",
      "cache.min_breakpoint_tokens"
    ] as const;

    for (const path of expectedPaths) {
      expect(configDescriptions[path], path).toBeDefined();
    }
  });
});
