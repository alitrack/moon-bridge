import type { Locale } from "../i18n/messages";

export type ConfigDocEntry = {
  path: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  type: string;
  defaultValue?: string;
  sensitive?: boolean;
  apply: Record<Locale, string>;
};

export const requiredConfigPaths = [
  "mode",
  "trace.enabled",
  "log.level",
  "log.format",
  "server.addr",
  "server.auth_token",
  "server.max_sessions",
  "server.session_ttl",
  "persistence.active_provider",
  "cache.mode",
  "cache.ttl",
  "cache.prompt_caching",
  "cache.automatic_prompt_cache",
  "cache.explicit_cache_breakpoints",
  "cache.allow_retention_downgrade",
  "cache.max_breakpoints",
  "cache.min_cache_tokens",
  "cache.expected_reuse",
  "cache.minimum_value_score",
  "cache.min_breakpoint_tokens",
  "defaults.model",
  "defaults.max_tokens",
  "defaults.system_prompt",
  "models.<slug>.context_window",
  "models.<slug>.max_output_tokens",
  "models.<slug>.slug",
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
  "providers.<key>.key",
  "providers.<key>.base_url",
  "providers.<key>.api_key",
  "providers.<key>.protocol",
  "providers.<key>.version",
  "providers.<key>.user_agent",
  "providers.<key>.web_search",
  "providers.<key>.extensions",
  "providers.<key>.offers[].model",
  "providers.<key>.offers[].upstream_name",
  "providers.<key>.offers[].priority",
  "providers.<key>.offers[].pricing",
  "providers.<key>.offers[].overrides",
  "routes.<alias>.alias",
  "routes.<alias>.to",
  "routes.<alias>.model",
  "routes.<alias>.provider",
  "routes.<alias>.display_name",
  "routes.<alias>.description",
  "routes.<alias>.context_window",
  "routes.<alias>.web_search",
  "routes.<alias>.extensions",
  "web_search.support",
  "web_search.max_uses",
  "web_search.tavily_api_key",
  "web_search.firecrawl_api_key",
  "web_search.search_max_rounds",
  "extensions.<name>.enabled",
  "extensions.<name>.config",
  "proxy.response",
  "proxy.anthropic"
] as const;

export type ConfigPath = (typeof requiredConfigPaths)[number];

export const configDescriptions: Record<ConfigPath, ConfigDocEntry> = {
  "mode": entry(
    "mode",
    "运行模式",
    "Run mode",
    "决定 Moon Bridge 如何处理请求：在协议之间转换，或直接转发给单一上游。",
    "How Moon Bridge handles requests: convert between formats, or pass straight through to one provider.",
    "Transform | CaptureResponse | CaptureAnthropic",
    "Transform"
  ),
  "trace.enabled": entry(
    "trace.enabled",
    "启用追踪",
    "Enable tracing",
    "记录每个请求的处理过程，方便排查问题。",
    "Records how each request is handled, for troubleshooting.",
    "boolean"
  ),
  "log.level": entry(
    "log.level",
    "日志级别",
    "Log level",
    "控制运行时输出的最低日志级别。",
    "Controls the minimum runtime log level.",
    "debug | info | warn | error",
    "info"
  ),
  "log.format": entry(
    "log.format",
    "日志格式",
    "Log format",
    "控制运行时日志输出为文本或 JSON。",
    "Controls whether runtime logs are emitted as text or JSON.",
    "text | json",
    "text"
  ),
  "server.addr": entry(
    "server.addr",
    "监听地址",
    "Listen address",
    "服务监听的地址。控制台和 API 都从这里访问。",
    "Address the server listens on. The console and API are served here.",
    "host:port",
    "127.0.0.1:38440"
  ),
  "server.auth_token": entry(
    "server.auth_token",
    "认证 Token",
    "Auth token",
    "控制台与 API 的访问密码。留空则不需要登录。",
    "Password for the console and API. Leave empty to disable sign-in.",
    "string",
    "empty",
    true
  ),
  "server.max_sessions": entry(
    "server.max_sessions",
    "最大会话数",
    "Max sessions",
    "允许保留的最大会话数量；0 表示不限制。",
    "Maximum retained session count; 0 means unlimited.",
    "number",
    "0"
  ),
  "server.session_ttl": entry(
    "server.session_ttl",
    "会话 TTL",
    "Session TTL",
    "会话状态保留时长，例如 24h。",
    "How long session state is retained, for example 24h.",
    "string",
    "24h"
  ),
  "persistence.active_provider": entry(
    "persistence.active_provider",
    "持久化提供商",
    "Persistence provider",
    "设置保存的位置。启用后才能在控制台保存修改。",
    "Where settings are stored. Needed to save changes from the console.",
    "db_sqlite | db_d1",
    "db_sqlite"
  ),
  "cache.mode": entry(
    "cache.mode",
    "缓存模式",
    "Cache mode",
    "提示词缓存的工作方式：关闭、显式断点、自动选择，或两者混合。",
    "How prompt caching works: off, explicit breakpoints, automatic, or a mix of both.",
    "off | explicit | automatic | hybrid",
    "explicit"
  ),
  "cache.ttl": entry(
    "cache.ttl",
    "缓存 TTL",
    "Cache TTL",
    "缓存条目的保留时长，例如 1h。",
    "Retention duration for cache entries, for example 1h.",
    "string"
  ),
  "cache.prompt_caching": entry(
    "cache.prompt_caching",
    "启用 Prompt Cache",
    "Enable prompt caching",
    "允许 Moon Bridge 为支持的上游协议启用 prompt cache。",
    "Allows Moon Bridge to enable prompt caching for supported upstream protocols.",
    "boolean"
  ),
  "cache.automatic_prompt_cache": entry(
    "cache.automatic_prompt_cache",
    "自动 Prompt Cache",
    "Automatic prompt cache",
    "根据请求内容自动选择合适的缓存断点。",
    "Automatically chooses suitable cache breakpoints from request content.",
    "boolean"
  ),
  "cache.explicit_cache_breakpoints": entry(
    "cache.explicit_cache_breakpoints",
    "显式缓存断点",
    "Explicit cache breakpoints",
    "允许请求显式指定 prompt cache 断点。",
    "Allows requests to explicitly specify prompt cache breakpoints.",
    "boolean"
  ),
  "cache.allow_retention_downgrade": entry(
    "cache.allow_retention_downgrade",
    "允许降级保留策略",
    "Allow retention downgrade",
    "当上游不支持所选缓存时长时，自动改用较短的可用时长。",
    "Use a shorter cache lifetime if the provider doesn't support the chosen one.",
    "boolean"
  ),
  "cache.max_breakpoints": entry(
    "cache.max_breakpoints",
    "最大断点数",
    "Max breakpoints",
    "单次请求可插入的最大缓存断点数量。",
    "Maximum number of cache breakpoints inserted for one request.",
    "number"
  ),
  "cache.min_cache_tokens": entry(
    "cache.min_cache_tokens",
    "最小缓存 Token",
    "Min cache tokens",
    "低于该 token 数的片段不会作为缓存候选。",
    "Segments below this token count are not considered cache candidates.",
    "number"
  ),
  "cache.expected_reuse": entry(
    "cache.expected_reuse",
    "预期复用次数",
    "Expected reuse",
    "缓存内容预期被复用的次数（用于自动缓存决策）。",
    "How many times a cached block is expected to be reused (for automatic caching).",
    "number"
  ),
  "cache.minimum_value_score": entry(
    "cache.minimum_value_score",
    "最小价值分",
    "Minimum value score",
    "自动缓存生效的最低价值阈值。",
    "Threshold below which automatic caching is skipped.",
    "number"
  ),
  "cache.min_breakpoint_tokens": entry(
    "cache.min_breakpoint_tokens",
    "最小断点 Token",
    "Min breakpoint tokens",
    "两个缓存点之间至少要相隔的 token 数。",
    "Minimum number of tokens between two cache points.",
    "number"
  ),
  "defaults.model": entry(
    "defaults.model",
    "默认模型",
    "Default model",
    "请求未指定模型时使用的模型。",
    "Model used when a request doesn't specify one.",
    "string",
    "moonbridge"
  ),
  "defaults.max_tokens": entry(
    "defaults.max_tokens",
    "默认最大 Token",
    "Default max tokens",
    "请求未提供 max_output_tokens 时的默认输出上限。",
    "Default output limit when a request does not provide max_output_tokens.",
    "number",
    "65536"
  ),
  "defaults.system_prompt": entry(
    "defaults.system_prompt",
    "全局系统提示词",
    "Global system prompt",
    "追加到请求中的全局 system prompt，适合放置所有模型共享的行为约束。",
    "Global system prompt appended to requests, useful for behavior rules shared by all models.",
    "string",
    "empty"
  ),
  "models.<slug>.context_window": entry(
    "models.<slug>.context_window",
    "上下文窗口",
    "Context window",
    "模型一次最多能处理的 token 数。",
    "Maximum tokens the model can handle at once.",
    "number"
  ),
  "models.<slug>.max_output_tokens": entry(
    "models.<slug>.max_output_tokens",
    "最大输出 Token",
    "Max output tokens",
    "模型单次响应允许的最大输出 token 数。",
    "Maximum output tokens the model can emit in one response.",
    "number"
  ),
  "models.<slug>.slug": entry(
    "models.<slug>.slug",
    "模型 Slug",
    "Model slug",
    "模型的稳定标识，其他设置通过它引用此模型。",
    "Stable id other settings use to refer to this model.",
    "string"
  ),
  "models.<slug>.display_name": entry(
    "models.<slug>.display_name",
    "模型显示名称",
    "Model display name",
    "控制台中展示的人类可读模型名称。",
    "Human-readable model name shown in the console.",
    "string"
  ),
  "models.<slug>.description": entry(
    "models.<slug>.description",
    "模型描述",
    "Model description",
    "描述模型用途、能力或限制，便于控制台识别。",
    "Describes model purpose, capabilities, or limits for console readers.",
    "string"
  ),
  "models.<slug>.base_instructions": entry(
    "models.<slug>.base_instructions",
    "基础指令",
    "Base instructions",
    "追加到该模型请求中的默认行为指令。",
    "Default behavior instructions appended to requests for this model.",
    "string"
  ),
  "models.<slug>.supports_reasoning": entry(
    "models.<slug>.supports_reasoning",
    "支持思考",
    "Supports reasoning",
    "标记该模型是否支持思考深度配置。",
    "Marks whether this model supports reasoning configuration.",
    "boolean"
  ),
  "models.<slug>.default_reasoning_level": entry(
    "models.<slug>.default_reasoning_level",
    "默认思考深度",
    "Default reasoning level",
    "请求未指定思考深度时使用的默认 level。",
    "Default reasoning level used when a request does not specify one.",
    "string"
  ),
  "models.<slug>.supported_reasoning_levels": entry(
    "models.<slug>.supported_reasoning_levels",
    "支持的思考深度",
    "Supported reasoning levels",
    "该模型允许选择的思考深度列表。",
    "List of reasoning levels allowed for this model.",
    "array"
  ),
  "models.<slug>.supports_reasoning_summaries": entry(
    "models.<slug>.supports_reasoning_summaries",
    "支持思考摘要",
    "Supports reasoning summaries",
    "标记该模型是否支持返回思考摘要。",
    "Marks whether this model supports returning reasoning summaries.",
    "boolean"
  ),
  "models.<slug>.default_reasoning_summary": entry(
    "models.<slug>.default_reasoning_summary",
    "默认思考摘要",
    "Default reasoning summary",
    "请求未指定摘要模式时使用的默认思考摘要设置。",
    "Default reasoning summary setting used when a request does not specify one.",
    "string"
  ),
  "models.<slug>.input_modalities": entry(
    "models.<slug>.input_modalities",
    "输入模态",
    "Input modalities",
    "该模型支持的输入类型，例如 text 或 image。",
    "Input types supported by this model, such as text or image.",
    "array"
  ),
  "models.<slug>.supports_image_detail_original": entry(
    "models.<slug>.supports_image_detail_original",
    "支持原始图像细节",
    "Supports original image detail",
    "标记视觉请求是否可向该模型发送 original 图像细节。",
    "Marks whether visual requests can send original image detail to this model.",
    "boolean"
  ),
  "models.<slug>.web_search": entry(
    "models.<slug>.web_search",
    "模型联网搜索",
    "Model web search",
    "覆盖该模型的联网搜索行为。",
    "Overrides web search behavior for this model.",
    "object"
  ),
  "models.<slug>.extensions": entry(
    "models.<slug>.extensions",
    "模型扩展",
    "Model extensions",
    "覆盖该模型启用的扩展工具和配置。",
    "Overrides extension tools and config enabled for this model.",
    "object"
  ),
  "providers.<key>.key": entry(
    "providers.<key>.key",
    "Provider Key",
    "Provider key",
    "提供商的稳定标识，路由通过它选择此提供商。",
    "Stable id routes use to pick this provider.",
    "string"
  ),
  "providers.<key>.base_url": entry(
    "providers.<key>.base_url",
    "上游 Base URL",
    "Upstream base URL",
    "上游 Provider API 地址。",
    "Upstream provider API URL.",
    "url"
  ),
  "providers.<key>.api_key": entry(
    "providers.<key>.api_key",
    "上游 API Key",
    "Upstream API key",
    "此提供商的 API 密钥。显示为掩码；输入新值即可更新。",
    "API key for this provider. Shown masked; enter a new value to update it.",
    "string",
    undefined,
    true
  ),
  "providers.<key>.protocol": entry(
    "providers.<key>.protocol",
    "上游协议",
    "Upstream protocol",
    "选择上游接口格式：Anthropic Messages、OpenAI Responses、Google GenAI 或 OpenAI Chat。",
    "Selects the upstream API format: Anthropic Messages, OpenAI Responses, Google GenAI, or OpenAI Chat.",
    "anthropic | openai-response | google-genai | openai-chat",
    "anthropic"
  ),
  "providers.<key>.version": entry(
    "providers.<key>.version",
    "协议版本",
    "Protocol version",
    "API 版本头（主要 Anthropic 使用），部分提供商可留空。",
    "API version header (mainly for Anthropic). Optional for some providers.",
    "string"
  ),
  "providers.<key>.user_agent": entry(
    "providers.<key>.user_agent",
    "User Agent",
    "User agent",
    "发送给提供商的 User-Agent 字符串。",
    "User-Agent string sent to the provider.",
    "string"
  ),
  "providers.<key>.web_search": entry(
    "providers.<key>.web_search",
    "提供商联网搜索",
    "Provider web search",
    "覆盖该 Provider 的联网搜索行为。",
    "Overrides web search behavior for this provider.",
    "object"
  ),
  "providers.<key>.extensions": entry(
    "providers.<key>.extensions",
    "提供商扩展",
    "Provider extensions",
    "覆盖该 Provider 启用的扩展工具和配置。",
    "Overrides extension tools and config enabled for this provider.",
    "object"
  ),
  "providers.<key>.offers[].model": entry(
    "providers.<key>.offers[].model",
    "提供商模型",
    "Provider model",
    "此绑定提供的模型。",
    "Which model this binding serves.",
    "string"
  ),
  "providers.<key>.offers[].upstream_name": entry(
    "providers.<key>.offers[].upstream_name",
    "上游模型名",
    "Upstream model name",
    "发送给提供商的真实模型名。留空则使用模型标识。",
    "Real model name sent to the provider. Leave empty to use the model id.",
    "string"
  ),
  "providers.<key>.offers[].priority": entry(
    "providers.<key>.offers[].priority",
    "提供商优先级",
    "Provider priority",
    "同一模型有多个提供商时的取舍权重，数值越小越优先。",
    "Tie-breaker when several providers serve the same model; lower wins.",
    "number"
  ),
  "providers.<key>.offers[].pricing": entry(
    "providers.<key>.offers[].pricing",
    "计费",
    "Billing",
    "可选的单价信息，用于费用统计。",
    "Optional prices for cost tracking.",
    "number"
  ),
  "providers.<key>.offers[].overrides": entry(
    "providers.<key>.offers[].overrides",
    "提供商覆盖配置",
    "Provider overrides",
    "该提供商绑定专用的模型能力覆盖项。",
    "Model capability overrides specific to this provider binding.",
    "object"
  ),
  "routes.<alias>.to": entry(
    "routes.<alias>.to",
    "路由目标",
    "Route target",
    "此路由指向的内部目标。",
    "Internal target this route points to.",
    "string"
  ),
  "routes.<alias>.model": entry(
    "routes.<alias>.model",
    "路由模型",
    "Route model",
    "此别名实际指向的模型。",
    "Model this alias points to.",
    "string"
  ),
  "routes.<alias>.alias": entry(
    "routes.<alias>.alias",
    "路由别名",
    "Route alias",
    "客户端在请求中使用的模型名。",
    "The model name clients send in requests.",
    "string"
  ),
  "routes.<alias>.provider": entry(
    "routes.<alias>.provider",
    "路由提供商",
    "Route provider",
    "处理该路由的 Provider key。",
    "Provider key that handles this route.",
    "string"
  ),
  "routes.<alias>.display_name": entry(
    "routes.<alias>.display_name",
    "路由显示名称",
    "Route display name",
    "控制台中展示的人类可读路由名称。",
    "Human-readable route name shown in the console.",
    "string"
  ),
  "routes.<alias>.description": entry(
    "routes.<alias>.description",
    "路由描述",
    "Route description",
    "描述该路由的用途或模型选择策略。",
    "Describes this route's purpose or model selection policy.",
    "string"
  ),
  "routes.<alias>.context_window": entry(
    "routes.<alias>.context_window",
    "路由上下文窗口",
    "Route context window",
    "该路由暴露给客户端的上下文窗口上限。",
    "Context window limit exposed to clients for this route.",
    "number"
  ),
  "routes.<alias>.web_search": entry(
    "routes.<alias>.web_search",
    "路由联网搜索",
    "Route web search",
    "覆盖该路由的联网搜索行为。",
    "Overrides web search behavior for this route.",
    "object"
  ),
  "routes.<alias>.extensions": entry(
    "routes.<alias>.extensions",
    "路由扩展",
    "Route extensions",
    "覆盖该路由启用的扩展工具和配置。",
    "Overrides extension tools and config enabled for this route.",
    "object"
  ),
  "web_search.support": entry(
    "web_search.support",
    "网页搜索模式",
    "Web search mode",
    "auto 优先使用 Provider 原生搜索并回退注入；enabled 强制原生；disabled 禁用；injected 使用 Tavily/Firecrawl 工具注入。",
    "auto prefers provider-native search and falls back to injection; enabled forces native; disabled turns it off; injected uses Tavily/Firecrawl tools.",
    "auto | enabled | disabled | injected",
    "auto"
  ),
  "web_search.max_uses": entry(
    "web_search.max_uses",
    "最大使用次数",
    "Max uses",
    "限制单次请求可使用的网页搜索次数。",
    "Limits how many web search calls one request may use.",
    "number"
  ),
  "web_search.tavily_api_key": entry(
    "web_search.tavily_api_key",
    "Tavily API Key",
    "Tavily API key",
    "注入式网页搜索使用的 Tavily 密钥。",
    "Tavily secret used by injected web search.",
    "string",
    undefined,
    true
  ),
  "web_search.firecrawl_api_key": entry(
    "web_search.firecrawl_api_key",
    "Firecrawl API Key",
    "Firecrawl API key",
    "注入式网页搜索用于抓取页面内容的 Firecrawl 密钥。",
    "Firecrawl secret used by injected web search to fetch page content.",
    "string",
    undefined,
    true
  ),
  "web_search.search_max_rounds": entry(
    "web_search.search_max_rounds",
    "最大搜索轮次",
    "Search max rounds",
    "单次请求最多执行的搜索轮数。",
    "Maximum number of search rounds per request.",
    "number",
    "3"
  ),
  "extensions.<name>.enabled": entry(
    "extensions.<name>.enabled",
    "启用扩展",
    "Enable extension",
    "开启或关闭此扩展。",
    "Turn this extension on or off.",
    "boolean"
  ),
  "extensions.<name>.config": entry(
    "extensions.<name>.config",
    "扩展配置",
    "Extension config",
    "此扩展的设置。",
    "Settings for this extension.",
    "object"
  ),
  "proxy.response": entry(
    "proxy.response",
    "OpenAI Capture 代理",
    "OpenAI capture proxy",
    "直通（Capture）模式下转发到 OpenAI 所需的地址、密钥和默认模型。",
    "Address, key, and default model used when passing requests straight through to OpenAI.",
    "object"
  ),
  "proxy.anthropic": entry(
    "proxy.anthropic",
    "Anthropic Capture 代理",
    "Anthropic capture proxy",
    "直通（Capture）模式下转发到 Anthropic 所需的地址、密钥、版本和模型。",
    "Address, key, version, and model used when passing requests straight through to Anthropic.",
    "object"
  )
};

export function getConfigDescription(path: ConfigPath, locale: Locale) {
  const entry = configDescriptions[path];
  return {
    ...entry,
    title: entry.title[locale],
    description: entry.description[locale],
    apply: entry.apply[locale]
  };
}

function entry(
  path: ConfigPath,
  zhTitle: string,
  enTitle: string,
  zhDescription: string,
  enDescription: string,
  type: string,
  defaultValue?: string,
  sensitive = false
): ConfigDocEntry {
  return {
    path,
    title: { "zh-CN": zhTitle, "en-US": enTitle },
    description: { "zh-CN": zhDescription, "en-US": enDescription },
    type,
    defaultValue,
    sensitive,
    apply: {
      "zh-CN": "即时保存；部分字段需重启后生效。",
      "en-US": "Saved instantly; some fields need a restart to take effect."
    }
  };
}
