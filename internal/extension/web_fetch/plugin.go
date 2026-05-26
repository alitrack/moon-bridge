// Package webfetch provides a proxy-side web_fetch tool for Codex.
// When enabled, it injects a web_fetch tool definition into requests
// and executes URL fetches on the proxy side (bypassing Codex sandbox).
package webfetch

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"moonbridge/internal/config"
	"moonbridge/internal/extension/plugin"
	"moonbridge/internal/format"
)

const PluginName = "web_fetch"

// Config for the web_fetch extension.
type Config struct {
	// Timeout for HTTP fetches (default 15s).
	TimeoutSeconds int `json:"timeout_seconds,omitempty" yaml:"timeout_seconds"`
	// Max response body bytes (default 50000).
	MaxBodyBytes int `json:"max_body_bytes,omitempty" yaml:"max_body_bytes"`
}

// Plugin implements ToolInjector + MessageRewriter.
type Plugin struct {
	plugin.BasePlugin
	cfg           *Config
	appCfg        config.Config
	currentConfig func() config.Config
}

func NewPlugin() *Plugin {
	return &Plugin{}
}

func (p *Plugin) Name() string { return PluginName }

func (p *Plugin) ConfigSpecs() []config.ExtensionConfigSpec {
	return ConfigSpecs()
}

func ConfigSpecs() []config.ExtensionConfigSpec {
	return []config.ExtensionConfigSpec{{
		Name: PluginName,
		Scopes: []config.ExtensionScope{
			config.ExtensionScopeGlobal,
			config.ExtensionScopeProvider,
			config.ExtensionScopeModel,
			config.ExtensionScopeRoute,
		},
		Factory: func() any { return &Config{} },
	}}
}

func (p *Plugin) Init(ctx plugin.PluginContext) error {
	p.cfg = plugin.Config[Config](ctx)
	if p.cfg == nil {
		p.cfg = &Config{}
	}
	if p.cfg.TimeoutSeconds <= 0 {
		p.cfg.TimeoutSeconds = 15
	}
	if p.cfg.MaxBodyBytes <= 0 {
		p.cfg.MaxBodyBytes = 50000
	}
	p.appCfg = ctx.AppConfig
	p.currentConfig = ctx.CurrentConfig
	return nil
}

func (p *Plugin) EnabledForModel(model string) bool {
	if p.currentConfig != nil {
		return p.currentConfig().ExtensionEnabled(PluginName, model)
	}
	return p.appCfg.ExtensionEnabled(PluginName, model)
}

// InjectTools implements plugin.ToolInjector.
func (p *Plugin) InjectTools(ctx *plugin.RequestContext) []format.CoreTool {
	return []format.CoreTool{{
		Name:        "web_fetch",
		Description: "Fetch content from a URL over HTTP/HTTPS. Use this to read web pages, API responses, or documentation. Returns the HTTP status, headers, and body as text.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"url": map[string]any{
					"type":        "string",
					"description": "The URL to fetch (must start with http:// or https://)",
				},
				"method": map[string]any{
					"type":        "string",
					"enum":        []string{"GET", "HEAD", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
					"description": "HTTP method (default: GET)",
				},
			},
			"required": []string{"url"},
		},
	}}
}

// RewriteMessages implements plugin.MessageRewriter.
// Scans incoming tool results for web_fetch calls and executes them proxy-side.
func (p *Plugin) RewriteMessages(ctx *plugin.RequestContext, messages []format.CoreMessage) []format.CoreMessage {
	for i := range messages {
		msg := &messages[i]
		if msg.Role != "tool" {
			continue
		}
		for j := range msg.Content {
			block := &msg.Content[j]
			if block.Type != "tool_result" {
				continue
			}
			// Check if the preceding assistant message has a matching tool_use for web_fetch
			if i > 0 && messages[i-1].Role == "assistant" {
				for _, ab := range messages[i-1].Content {
					if ab.Type == "tool_use" && ab.ToolUseID == block.ToolUseID && ab.ToolName == "web_fetch" {
						// This is a web_fetch call — execute it proxy-side
						result := p.executeFetch(ab.ToolInput)
						block.ToolResultContent = []format.CoreContentBlock{{
							Type: "text",
							Text: result,
						}}
					}
				}
			}
		}
	}
	return messages
}

func (p *Plugin) executeFetch(input json.RawMessage) string {
	var args struct {
		URL    string `json:"url"`
		Method string `json:"method"`
	}
	if err := json.Unmarshal(input, &args); err != nil {
		return fmt.Sprintf(`{"error": "invalid arguments: %v"}`, err)
	}
	if args.URL == "" {
		return `{"error": "url is required"}`
	}
	if !strings.HasPrefix(args.URL, "http://") && !strings.HasPrefix(args.URL, "https://") {
		return `{"error": "url must start with http:// or https://"}`
	}
	if args.Method == "" {
		args.Method = "GET"
	}

	client := &http.Client{Timeout: time.Duration(p.cfg.TimeoutSeconds) * time.Second}
	req, err := http.NewRequest(args.Method, args.URL, nil)
	if err != nil {
		return fmt.Sprintf(`{"error": "failed to create request: %v"}`, err)
	}
	req.Header.Set("User-Agent", "MoonBridge-WebFetch/1.0")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Sprintf(`{"error": "fetch failed: %v"}`, err)
	}
	defer resp.Body.Close()

	limited := io.LimitReader(resp.Body, int64(p.cfg.MaxBodyBytes))
	body, err := io.ReadAll(limited)
	if err != nil {
		return fmt.Sprintf(`{"error": "read failed: %v", "status": %d}`, err, resp.StatusCode)
	}

	return fmt.Sprintf(`{"status": %d, "content_type": %q, "body": %s}`,
		resp.StatusCode,
		resp.Header.Get("Content-Type"),
		jsonEscape(string(body)),
	)
}

func jsonEscape(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

// Compile-time interface checks.
var (
	_ plugin.Plugin         = (*Plugin)(nil)
	_ plugin.ToolInjector   = (*Plugin)(nil)
	_ plugin.MessageRewriter = (*Plugin)(nil)
)
