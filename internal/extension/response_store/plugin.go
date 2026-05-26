// Package responsestore provides response storage and previous_response_id
// bridging for Codex sessions. Responses are stored in an in-memory LRU cache.
// When a new request carries a previous_response_id, the stored response's
// assistant output is prepended to the input for conversation continuity.
package responsestore

import (
	"encoding/json"
	"sync"
	"time"

	"moonbridge/internal/config"
	"moonbridge/internal/extension/plugin"
	"moonbridge/internal/protocol/openai"
)

const PluginName = "response_store"

type Config struct {
	TTLSeconds int `json:"ttl_seconds,omitempty" yaml:"ttl_seconds"`
	MaxEntries int `json:"max_entries,omitempty" yaml:"max_entries"`
}

type storedResponse struct {
	output   []openai.OutputItem
	storedAt time.Time
}

// Global store so it's accessible from dispatch.go without coupling to Plugin.
var (
	globalMu    sync.RWMutex
	globalStore = make(map[string]*storedResponse)
)

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
			config.ExtensionScopeModel,
		},
		Factory: func() any { return &Config{} },
	}}
}

func (p *Plugin) Init(ctx plugin.PluginContext) error {
	p.cfg = plugin.Config[Config](ctx)
	if p.cfg == nil {
		p.cfg = &Config{TTLSeconds: 3600, MaxEntries: 500}
	}
	if p.cfg.TTLSeconds <= 0 {
		p.cfg.TTLSeconds = 3600
	}
	if p.cfg.MaxEntries <= 0 {
		p.cfg.MaxEntries = 500
	}
	p.appCfg = ctx.AppConfig
	p.currentConfig = ctx.CurrentConfig
	return nil
}

func (p *Plugin) EnabledForModel(model string) bool { return true }

// PostProcessResponse stores the response for future bridging.
func (p *Plugin) PostProcessResponse(ctx *plugin.RequestContext, resp *openai.Response) {
	if resp == nil || resp.ID == "" || len(resp.Output) == 0 {
		return
	}
	StoreResponse(resp, p.cfg.TTLSeconds, p.cfg.MaxEntries)
}

// StoreResponse saves a response in the global cache. Exported so it can
// be called from non-plugin code (e.g., dispatch.go for bridging).
func StoreResponse(resp *openai.Response, ttlSeconds, maxEntries int) {
	globalMu.Lock()
	defer globalMu.Unlock()

	now := time.Now()
	for id, entry := range globalStore {
		if now.Sub(entry.storedAt) > time.Duration(ttlSeconds)*time.Second {
			delete(globalStore, id)
		}
	}
	if len(globalStore) >= maxEntries {
		for id := range globalStore {
			delete(globalStore, id)
			break
		}
	}
	globalStore[resp.ID] = &storedResponse{output: resp.Output, storedAt: now}
}

// GetStoredResponse returns the stored output items for a given response ID,
// or nil if not found or expired.
func GetStoredResponse(responseID string) []openai.OutputItem {
	globalMu.RLock()
	defer globalMu.RUnlock()

	entry, ok := globalStore[responseID]
	if !ok {
		return nil
	}
	return entry.output
}

// BridgePreviousResponse takes a ResponsesRequest and, if it has a
// previous_response_id, prepends the assistant's output from that
// prior response to the new request's input messages.
//
// Returns the modified input or the original input (with the response text
// prepended) when bridging is possible; returns nil, false if there is
// no previous_response_id or the stored response can't be found.
func BridgePreviousResponse(req *openai.ResponsesRequest) (string, bool) {
	if req.PreviousResponseID == "" {
		return "", false
	}

	output := GetStoredResponse(req.PreviousResponseID)
	if output == nil || len(output) == 0 {
		return "", false
	}

	// Extract assistant message text from the stored response
	var prevText string
	for _, item := range output {
		if item.Type == "message" && item.Role == "assistant" {
			for _, part := range item.Content {
				if part.Type == "text" && part.Text != "" {
					if prevText != "" {
						prevText += "\n"
					}
					prevText += part.Text
				}
			}
		}
	}

	if prevText == "" {
		return "", false
	}

	// Build a bridge message: [previous assistant response] + [current user input]
	currentInput := extractInputText(req.Input)
	if currentInput == "" {
		currentInput = "[follow-up request]"
	}

	return "[Previous assistant response:\n" + prevText + "\n]\n\n[User now says:\n" + currentInput + "\n]", true
}

// extractInputText pulls the text content from a ResponsesRequest Input field.
func extractInputText(input json.RawMessage) string {
	if len(input) == 0 {
		return ""
	}

	// Try string first
	var s string
	if err := json.Unmarshal(input, &s); err == nil && s != "" {
		return s
	}

	// Try array of content parts
	var parts []struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(input, &parts); err == nil {
		for _, p := range parts {
			if p.Text != "" {
				return p.Text
			}
		}
	}

	return ""
}

var (
	_ plugin.Plugin                = (*Plugin)(nil)
	_ plugin.ResponsePostProcessor = (*Plugin)(nil)
)
