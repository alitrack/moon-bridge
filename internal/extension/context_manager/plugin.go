// Package contextmanager prevents context window overflow by estimating
// token usage and truncating oldest messages when approaching model limits.
// Conservative estimation (2.0 chars/token) prevents DeepSeek and other
// providers from hitting their hard token limits mid-request.
package contextmanager

import (
	"encoding/json"

	"moonbridge/internal/config"
	"moonbridge/internal/extension/plugin"
	"moonbridge/internal/format"
)

const PluginName = "context_manager"

// Config for the context_manager extension.
type Config struct {
	// ContextLimit is the model's max context window in tokens.
	// Default: 1,048,576 (DeepSeek V4's 1M token limit).
	ContextLimit int `json:"context_limit,omitempty" yaml:"context_limit"`

	// CompletionHeadroom is tokens reserved for the completion response.
	// Default: 8,192.
	CompletionHeadroom int `json:"completion_headroom,omitempty" yaml:"completion_headroom"`

	// CharsPerToken is the conservative estimation ratio.
	// Default: 2.0 (code/JSON tokenizes more densely than prose).
	CharsPerToken float64 `json:"chars_per_token,omitempty" yaml:"chars_per_token"`

	// MinRecentMessages is the minimum number of recent messages to always keep.
	// Default: 10.
	MinRecentMessages int `json:"min_recent_messages,omitempty" yaml:"min_recent_messages"`
}

// Plugin implements plugin.Plugin + plugin.MessageRewriter.
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
	if p.cfg.ContextLimit <= 0 {
		p.cfg.ContextLimit = 1048576 // 1M tokens (DeepSeek V4 default)
	}
	if p.cfg.CompletionHeadroom <= 0 {
		p.cfg.CompletionHeadroom = 8192
	}
	if p.cfg.CharsPerToken <= 0 {
		p.cfg.CharsPerToken = 2.0
	}
	if p.cfg.MinRecentMessages <= 0 {
		p.cfg.MinRecentMessages = 10
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

// RewriteMessages implements plugin.MessageRewriter.
// Truncates oldest non-system messages when estimated token count
// exceeds the context budget.
func (p *Plugin) RewriteMessages(ctx *plugin.RequestContext, messages []format.CoreMessage) []format.CoreMessage {
	budget := float64(p.cfg.ContextLimit - p.cfg.CompletionHeadroom)

	// Estimate total tokens.
	totalTokens := estimateMessagesTokens(messages, p.cfg.CharsPerToken)
	if totalTokens <= budget {
		return messages
	}

	// Separate system messages (always kept).
	var systemMsgs []format.CoreMessage
	var historyMsgs []format.CoreMessage
	for _, m := range messages {
		if m.Role == "system" {
			systemMsgs = append(systemMsgs, m)
		} else {
			historyMsgs = append(historyMsgs, m)
		}
	}

	systemTokens := estimateMessagesTokens(systemMsgs, p.cfg.CharsPerToken)

	// Drop oldest messages from the front until within budget.
	// Always keep the most recent MinRecentMessages.
	minKeep := p.cfg.MinRecentMessages
	for len(historyMsgs) > minKeep {
		currentTotal := systemTokens + estimateMessagesTokens(historyMsgs, p.cfg.CharsPerToken)
		if currentTotal <= budget {
			break
		}
		historyMsgs = historyMsgs[1:]
	}

	// Inject truncation notice if messages were dropped.
	if len(historyMsgs) < len(messages)-len(systemMsgs) {
		notice := format.CoreMessage{
			Role: "user",
			Content: []format.CoreContentBlock{{
				Type: "text",
				Text: "[System: Earlier conversation history has been truncated to fit within the model's context window. Do not repeat previous statements or tool calls you already made. Continue with the current task based on the remaining context above. If you have enough information, respond to the user instead of making more tool calls.]",
			}},
		}
		// Insert after system messages, before history.
		result := make([]format.CoreMessage, 0, len(systemMsgs)+1+len(historyMsgs))
		result = append(result, systemMsgs...)
		result = append(result, notice)
		result = append(result, historyMsgs...)
		return result
	}

	// No truncation needed for history part — system msgs unchanged.
	result := make([]format.CoreMessage, 0, len(systemMsgs)+len(historyMsgs))
	result = append(result, systemMsgs...)
	result = append(result, historyMsgs...)
	return result
}

// estimateMessagesTokens estimates token count for a slice of messages.
func estimateMessagesTokens(messages []format.CoreMessage, charsPerToken float64) float64 {
	var total float64
	for _, m := range messages {
		data, _ := json.Marshal(m.Content)
		total += float64(len(data)) / charsPerToken
	}
	return total
}

// Compile-time interface checks.
var (
	_ plugin.Plugin          = (*Plugin)(nil)
	_ plugin.MessageRewriter = (*Plugin)(nil)
)
