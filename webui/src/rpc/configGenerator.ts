import { stringify } from "yaml";

export type GeneratedConfigDraft = {
  mode: "Transform" | "CaptureResponse" | "CaptureAnthropic";
  server?: {
    addr?: string;
    auth_token?: string;
  };
  defaults?: {
    model?: string;
    max_tokens?: number;
    system_prompt?: string;
  };
  persistence?: {
    active_provider?: string;
  };
  cache?: {
    mode?: string;
    ttl?: string;
    prompt_caching?: boolean;
    automatic_prompt_cache?: boolean;
    explicit_cache_breakpoints?: boolean;
    allow_retention_downgrade?: boolean;
    max_breakpoints?: number;
    min_cache_tokens?: number;
    expected_reuse?: number;
    minimum_value_score?: number;
    min_breakpoint_tokens?: number;
  };
  web_search?: {
    support?: string;
    max_uses?: number;
    tavily_api_key?: string;
    firecrawl_api_key?: string;
    search_max_rounds?: number;
  };
  models?: GeneratedModel[];
  providers?: GeneratedProvider[];
  routes?: GeneratedRoute[];
  extensions?: GeneratedExtension[];
  proxy?: {
    response?: GeneratedProxyTarget;
    anthropic?: GeneratedProxyTarget;
  };
};

export type GeneratedModel = {
  slug: string;
  context_window?: number;
  max_output_tokens?: number;
  display_name?: string;
  description?: string;
};

export type GeneratedProvider = {
  key: string;
  base_url: string;
  api_key: string;
  version?: string;
  user_agent?: string;
  protocol?: string;
  offers?: GeneratedOffer[];
};

export type GeneratedOffer = {
  model: string;
  upstream_name?: string;
  priority?: number;
  input_price?: number;
  output_price?: number;
  cache_write_price?: number;
  cache_read_price?: number;
};

export type GeneratedRoute = {
  alias: string;
  model?: string;
  provider?: string;
  display_name?: string;
  description?: string;
  context_window?: number;
};

export type GeneratedExtension = {
  name: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

export type GeneratedProxyTarget = {
  base_url: string;
  api_key: string;
  model?: string;
  version?: string;
};

export function generateConfigYAML(draft: GeneratedConfigDraft): string {
  const doc = pruneEmpty({
    mode: draft.mode,
    server: pruneEmpty({
      addr: draft.server?.addr || "127.0.0.1:38440",
      auth_token: draft.server?.auth_token
    }),
    persistence: pruneEmpty({
      active_provider: draft.persistence?.active_provider ?? "db_sqlite"
    }),
    defaults: pruneEmpty(draft.defaults ?? { model: firstRouteModel(draft), max_tokens: 4096 }),
    cache: pruneEmpty(
      draft.cache ?? {
        mode: "explicit",
        ttl: "5m",
        prompt_caching: true,
        automatic_prompt_cache: false,
        explicit_cache_breakpoints: true,
        allow_retention_downgrade: false,
        max_breakpoints: 4,
        min_cache_tokens: 1024,
        expected_reuse: 2,
        minimum_value_score: 2048,
        min_breakpoint_tokens: 1024
      }
    ),
    web_search: pruneEmpty(draft.web_search),
    models: keyed(draft.models, "slug", (model) =>
      pruneEmpty({
        context_window: model.context_window,
        max_output_tokens: model.max_output_tokens,
        display_name: model.display_name,
        description: model.description
      })
    ),
    providers: keyed(draft.providers, "key", (provider) =>
      pruneEmpty({
        base_url: provider.base_url,
        api_key: provider.api_key,
        version: provider.version,
        user_agent: provider.user_agent,
        protocol: provider.protocol,
        offers: provider.offers?.map((offer) =>
          pruneEmpty({
            model: offer.model,
            upstream_name: offer.upstream_name,
            priority: offer.priority,
            pricing: pruneEmpty({
              input_price: offer.input_price,
              output_price: offer.output_price,
              cache_write_price: offer.cache_write_price,
              cache_read_price: offer.cache_read_price
            })
          })
        )
      })
    ),
    routes: keyed(draft.routes, "alias", (route) =>
      pruneEmpty({
        model: route.model,
        provider: route.provider,
        display_name: route.display_name,
        description: route.description,
        context_window: route.context_window
      })
    ),
    extensions: keyed(draft.extensions, "name", (extension) =>
      pruneEmpty({
        enabled: extension.enabled,
        config: pruneEmpty(extension.config)
      })
    ),
    proxy: pruneEmpty({
      response: pruneEmpty(draft.proxy?.response),
      anthropic: pruneEmpty(draft.proxy?.anthropic)
    })
  });

  return stringify(doc, { indent: 2 });
}

function firstRouteModel(draft: GeneratedConfigDraft) {
  return draft.routes?.[0]?.alias ?? draft.models?.[0]?.slug ?? "";
}

function keyed<T extends Record<string, unknown>>(
  rows: T[] | undefined,
  key: keyof T,
  build: (row: T) => unknown
) {
  if (!rows?.length) {
    return undefined;
  }
  return rows.reduce<Record<string, unknown>>((out, row) => {
    const name = String(row[key] ?? "");
    if (name) {
      out[name] = build(row);
    }
    return out;
  }, {});
}

function pruneEmpty<T>(value: T): T | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (Array.isArray(value)) {
    const next = value.map(pruneEmpty).filter((entry) => entry !== undefined);
    return (next.length ? next : undefined) as T | undefined;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).flatMap(([key, entry]) => {
      const next = pruneEmpty(entry);
      return next === undefined ? [] : [[key, next]];
    });
    return (entries.length ? Object.fromEntries(entries) : undefined) as T | undefined;
  }
  return value;
}
