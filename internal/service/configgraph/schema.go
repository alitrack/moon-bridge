package configgraph

type ResourceDefinition struct {
	Kind          string
	Label         string
	HotReloadable bool
	RuntimeImpact RuntimeImpact
	Fields        []FieldSchema
}

func ResourceDefinitions() []ResourceDefinition {
	return []ResourceDefinition{
		{
			Kind:          string(ResourceMode),
			Label:         "Mode",
			HotReloadable: false,
			RuntimeImpact: ImpactCritical,
			Fields: []FieldSchema{
				enumField("mode", "Mode", []string{"Transform", "CaptureResponse", "CaptureAnthropic"}, false, "critical"),
			},
		},
		{
			Kind:          string(ResourceTrace),
			Label:         "Trace",
			HotReloadable: true,
			RuntimeImpact: ImpactNormal,
			Fields: []FieldSchema{
				boolField("enabled", "Enabled", true, "normal"),
			},
		},
		{
			Kind:          string(ResourceLog),
			Label:         "Log",
			HotReloadable: false,
			RuntimeImpact: ImpactNormal,
			Fields: []FieldSchema{
				enumField("level", "Level", []string{"debug", "info", "warn", "error"}, false, "normal"),
				enumField("format", "Format", []string{"text", "json"}, false, "normal"),
			},
		},
		{
			Kind:          string(ResourceServer),
			Label:         "Server",
			HotReloadable: false,
			RuntimeImpact: ImpactCritical,
			Fields: []FieldSchema{
				stringField("addr", "Address", false, false, "critical"),
				stringField("auth_token", "Auth Token", false, true, "critical"),
				numberField("max_sessions", "Max Sessions", false, "normal"),
				stringField("session_ttl", "Session TTL", false, false, "normal"),
			},
		},
		{
			Kind:          string(ResourceDefaults),
			Label:         "Defaults",
			HotReloadable: true,
			RuntimeImpact: ImpactNormal,
			Fields: []FieldSchema{
				stringField("model", "Model", false, false, "normal"),
				numberField("max_tokens", "Max Tokens", true, "normal"),
				textField("system_prompt", "System Prompt", true, "normal"),
			},
		},
		{
			Kind:          string(ResourceModel),
			Label:         "Model",
			HotReloadable: true,
			RuntimeImpact: ImpactNormal,
			Fields: []FieldSchema{
				numberField("context_window", "Context Window", true, "normal"),
				numberField("max_output_tokens", "Max Output Tokens", true, "normal"),
				stringField("display_name", "Display Name", true, false, "normal"),
				textField("description", "Description", true, "normal"),
				textField("base_instructions", "Base Instructions", true, "normal"),
				boolField("supports_reasoning", "Supports Reasoning", true, "normal"),
				stringField("default_reasoning_level", "Default Reasoning Level", true, false, "normal"),
				arrayField("supported_reasoning_levels", "Supported Reasoning Levels", true, "normal"),
				boolField("supports_reasoning_summaries", "Supports Reasoning Summaries", true, "normal"),
				stringField("default_reasoning_summary", "Default Reasoning Summary", true, false, "normal"),
				arrayField("input_modalities", "Input Modalities", true, "normal"),
				boolField("supports_image_detail_original", "Supports Original Image Detail", true, "normal"),
				objectField("web_search", "Web Search", true, "normal"),
				objectField("extensions", "Extensions", true, "normal"),
			},
		},
		{
			Kind:          string(ResourceProvider),
			Label:         "Provider",
			HotReloadable: true,
			RuntimeImpact: ImpactCritical,
			Fields: []FieldSchema{
				stringField("base_url", "Base URL", true, false, "critical"),
				stringField("api_key", "API Key", true, true, "critical"),
				stringField("version", "Version", true, false, "normal"),
				stringField("user_agent", "User Agent", true, false, "normal"),
				enumField("protocol", "Protocol", []string{"anthropic", "openai-response", "google-genai", "openai-chat"}, true, "critical"),
				objectField("web_search", "Web Search", true, "normal"),
				objectField("extensions", "Extensions", true, "normal"),
			},
		},
		{
			Kind:          string(ResourceProviderOffer),
			Label:         "Provider Offer",
			HotReloadable: true,
			RuntimeImpact: ImpactNormal,
			Fields: []FieldSchema{
				stringField("model", "Model", true, false, "critical"),
				stringField("upstream_name", "Upstream Name", true, false, "normal"),
				numberField("priority", "Priority", true, "normal"),
				objectField("pricing", "Pricing", true, "normal"),
				objectField("overrides", "Overrides", true, "normal"),
			},
		},
		{
			Kind:          string(ResourceRoute),
			Label:         "Route",
			HotReloadable: true,
			RuntimeImpact: ImpactCritical,
			Fields: []FieldSchema{
				stringField("to", "Route Target", true, false, "critical"),
				stringField("model", "Model", true, false, "critical"),
				stringField("provider", "Provider", true, false, "critical"),
				stringField("display_name", "Display Name", true, false, "normal"),
				textField("description", "Description", true, "normal"),
				numberField("context_window", "Context Window", true, "normal"),
				objectField("web_search", "Web Search", true, "normal"),
				objectField("extensions", "Extensions", true, "normal"),
			},
		},
		{
			Kind:          string(ResourceWebSearch),
			Label:         "Web Search",
			HotReloadable: true,
			RuntimeImpact: ImpactNormal,
			Fields: []FieldSchema{
				enumField("support", "Support", []string{"auto", "enabled", "disabled", "injected"}, true, "normal"),
				numberField("max_uses", "Max Uses", true, "normal"),
				stringField("tavily_api_key", "Tavily API Key", true, true, "normal"),
				stringField("firecrawl_api_key", "Firecrawl API Key", true, true, "normal"),
				numberField("search_max_rounds", "Search Max Rounds", true, "normal"),
			},
		},
		{
			Kind:          string(ResourceCache),
			Label:         "Cache",
			HotReloadable: true,
			RuntimeImpact: ImpactNormal,
			Fields: []FieldSchema{
				stringField("mode", "Mode", true, false, "normal"),
				stringField("ttl", "TTL", true, false, "normal"),
				boolField("prompt_caching", "Prompt Caching", true, "normal"),
				boolField("automatic_prompt_cache", "Automatic Prompt Cache", true, "normal"),
				boolField("explicit_cache_breakpoints", "Explicit Cache Breakpoints", true, "normal"),
				boolField("allow_retention_downgrade", "Allow Retention Downgrade", true, "normal"),
				numberField("max_breakpoints", "Max Breakpoints", true, "normal"),
				numberField("min_cache_tokens", "Min Cache Tokens", true, "normal"),
				numberField("expected_reuse", "Expected Reuse", true, "normal"),
				numberField("minimum_value_score", "Minimum Value Score", true, "normal"),
				numberField("min_breakpoint_tokens", "Min Breakpoint Tokens", true, "normal"),
			},
		},
		{
			Kind:          string(ResourcePersistence),
			Label:         "Persistence",
			HotReloadable: false,
			RuntimeImpact: ImpactNormal,
			Fields: []FieldSchema{
				stringField("active_provider", "Active Provider", true, false, "normal"),
			},
		},
		{
			Kind:          string(ResourceExtension),
			Label:         "Extension",
			HotReloadable: true,
			RuntimeImpact: ImpactNormal,
			Fields: []FieldSchema{
				boolField("enabled", "Enabled", true, "normal"),
				objectField("config", "Config", true, "normal"),
			},
		},
		{
			Kind:          string(ResourceProxy),
			Label:         "Proxy",
			HotReloadable: false,
			RuntimeImpact: ImpactCritical,
			Fields: []FieldSchema{
				objectField("response", "Response Proxy", true, "critical"),
				objectField("anthropic", "Anthropic Proxy", true, "critical"),
			},
		},
	}
}

func stringField(path, label string, hotReloadable, secret bool, impact string) FieldSchema {
	control := "text"
	if secret {
		control = "secret"
	}
	return FieldSchema{
		Path:          path,
		Type:          "string",
		Label:         label,
		Secret:        secret,
		Control:       control,
		HotReloadable: hotReloadable,
		RuntimeImpact: impact,
	}
}

func textField(path, label string, hotReloadable bool, impact string) FieldSchema {
	field := stringField(path, label, hotReloadable, false, impact)
	field.Control = "textarea"
	return field
}

func numberField(path, label string, hotReloadable bool, impact string) FieldSchema {
	return FieldSchema{
		Path:          path,
		Type:          "number",
		Label:         label,
		Control:       "number",
		HotReloadable: hotReloadable,
		RuntimeImpact: impact,
	}
}

func boolField(path, label string, hotReloadable bool, impact string) FieldSchema {
	return FieldSchema{
		Path:          path,
		Type:          "boolean",
		Label:         label,
		Control:       "switch",
		HotReloadable: hotReloadable,
		RuntimeImpact: impact,
	}
}

func enumField(path, label string, values []string, hotReloadable bool, impact string) FieldSchema {
	return FieldSchema{
		Path:          path,
		Type:          "string",
		Label:         label,
		Control:       "select",
		Enum:          values,
		HotReloadable: hotReloadable,
		RuntimeImpact: impact,
	}
}

func arrayField(path, label string, hotReloadable bool, impact string) FieldSchema {
	return FieldSchema{
		Path:          path,
		Type:          "array",
		Label:         label,
		Control:       "array",
		HotReloadable: hotReloadable,
		RuntimeImpact: impact,
	}
}

func objectField(path, label string, hotReloadable bool, impact string) FieldSchema {
	return FieldSchema{
		Path:          path,
		Type:          "object",
		Label:         label,
		Control:       "object",
		HotReloadable: hotReloadable,
		RuntimeImpact: impact,
	}
}
