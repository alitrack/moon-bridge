import { parse } from "yaml";
import { describe, expect, test } from "vitest";
import { generateConfigYAML, type GeneratedConfigDraft } from "./configGenerator";

describe("generateConfigYAML", () => {
  test("generates transform config with provider, model, offer, route, and sqlite persistence", () => {
    const draft: GeneratedConfigDraft = {
      mode: "Transform",
      server: { addr: "127.0.0.1:38440", auth_token: "secret-token" },
      persistence: { active_provider: "db_sqlite" },
      defaults: { model: "moonbridge", max_tokens: 4096 },
      providers: [
        {
          key: "anthropic",
          base_url: "https://api.anthropic.com",
          api_key: "sk-ant",
          protocol: "anthropic",
          version: "2023-06-01",
          offers: [
            {
              model: "claude-sonnet",
              upstream_name: "claude-3-5-sonnet",
              input_price: 3,
              output_price: 15,
              cache_write_price: 3.75,
              cache_read_price: 0.3
            }
          ]
        }
      ],
      models: [
        {
          slug: "claude-sonnet",
          display_name: "Claude Sonnet",
          context_window: 200000,
          max_output_tokens: 64000
        }
      ],
      routes: [
        {
          alias: "moonbridge",
          model: "claude-sonnet",
          provider: "anthropic",
          display_name: "Moon Bridge"
        }
      ]
    };

    const yaml = generateConfigYAML(draft);
    const parsed = parse(yaml);

    expect(parsed.mode).toBe("Transform");
    expect(parsed.server.auth_token).toBe("secret-token");
    expect(parsed.persistence.active_provider).toBe("db_sqlite");
    expect(parsed.providers.anthropic.offers[0].pricing.cache_read_price).toBe(0.3);
    expect(parsed.models["claude-sonnet"].context_window).toBe(200000);
    expect(parsed.routes.moonbridge.provider).toBe("anthropic");
  });

  test("generates capture response proxy config", () => {
    const yaml = generateConfigYAML({
      mode: "CaptureResponse",
      server: { addr: "127.0.0.1:38440" },
      proxy: {
        response: {
          base_url: "https://api.openai.com",
          api_key: "openai-key",
          model: "gpt-5.4"
        }
      }
    });
    const parsed = parse(yaml);

    expect(parsed.mode).toBe("CaptureResponse");
    expect(parsed.proxy.response.base_url).toBe("https://api.openai.com");
    expect(parsed.proxy.response.api_key).toBe("openai-key");
    expect(parsed.proxy.response.model).toBe("gpt-5.4");
  });

  test("generates capture anthropic proxy config", () => {
    const yaml = generateConfigYAML({
      mode: "CaptureAnthropic",
      server: { addr: "127.0.0.1:38440" },
      proxy: {
        anthropic: {
          base_url: "https://provider.example.com",
          api_key: "anthropic-key",
          version: "2023-06-01",
          model: "claude-sonnet"
        }
      }
    });
    const parsed = parse(yaml);

    expect(parsed.mode).toBe("CaptureAnthropic");
    expect(parsed.proxy.anthropic.base_url).toBe("https://provider.example.com");
    expect(parsed.proxy.anthropic.version).toBe("2023-06-01");
    expect(parsed.proxy.anthropic.model).toBe("claude-sonnet");
  });
});
