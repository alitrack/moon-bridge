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

	// CharsPerToken is the estimation ratio for token counting.
	// Default: 0 (auto: CJK=0.75, code=1.3, Latin=3.8).
	// Set to e.g. 2.0 for legacy fixed-ratio behavior.
	CharsPerToken float64 `json:"chars_per_token,omitempty" yaml:"chars_per_token"`

	// MinRecentMessages is the minimum number of recent messages to always keep.
	// Default: 10.
	MinRecentMessages int `json:"min_recent_messages,omitempty" yaml:"min_recent_messages"`

	// CachePreserving enables prefix-cache-safe truncation for DeepSeek.
	// When true (default): only truncate from the front of history (preserving byte
	// prefix for subsequent messages) and append truncation notices at the
	// end instead of injecting them mid-stream.
	// When false: legacy behavior — inject notice between system and history.
	// Default: true (nil = true).
	CachePreserving *bool `json:"cache_preserving,omitempty" yaml:"cache_preserving"`
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
		p.cfg.CharsPerToken = 0 // default to context-aware estimation
	}
	if p.cfg.MinRecentMessages <= 0 {
		p.cfg.MinRecentMessages = 10
	}
	if p.cfg.CachePreserving == nil {
		defaultPreserving := true
		p.cfg.CachePreserving = &defaultPreserving
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

	originalHistoryLen := len(historyMsgs)

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
	// Cache-preserving mode: append notice at end to avoid breaking prefix cache.
	// Legacy mode: inject notice between system and history (breaks cache).
	if len(historyMsgs) < originalHistoryLen {
		notice := format.CoreMessage{
			Role: "user",
			Content: []format.CoreContentBlock{{
				Type: "text",
				Text: "[System: Earlier conversation history has been truncated to fit within the model's context window. Do not repeat previous statements or tool calls you already made. Continue with the current task based on the remaining context above. If you have enough information, respond to the user instead of making more tool calls.]",
			}},
		}
		result := make([]format.CoreMessage, 0, len(systemMsgs)+len(historyMsgs)+1)
		result = append(result, systemMsgs...)
		if p.cfg.CachePreserving != nil && *p.cfg.CachePreserving {
			// CACHE-SAFE: append notice at the end so the byte prefix of all
			// preceding messages stays identical — DeepSeek's KV cache hits
			// on the entire history up to the notice.
			result = append(result, historyMsgs...)
			result = append(result, notice)
		} else {
			// LEGACY: inject notice between system and history (breaks prefix cache
			// because all subsequent messages shift by notice length).
			result = append(result, notice)
			result = append(result, historyMsgs...)
		}
		return result
	}

	// No truncation needed for history part — system msgs unchanged.
	result := make([]format.CoreMessage, 0, len(systemMsgs)+len(historyMsgs))
	result = append(result, systemMsgs...)
	result = append(result, historyMsgs...)
	return result
}

// estimateMessagesTokens estimates token count for a slice of messages.
// When charsPerToken <= 0, uses context-aware estimation that distinguishes
// CJK characters (0.75 chars/token), code/JSON blocks (1.3), and Latin prose (3.8).
// When charsPerToken > 0, falls back to the legacy fixed-ratio estimator.
func estimateMessagesTokens(messages []format.CoreMessage, charsPerToken float64) float64 {
	if charsPerToken > 0 {
		return estimateFixed(messages, charsPerToken)
	}
	var total float64
	for _, m := range messages {
		data, _ := json.Marshal(m.Content)
		total += estimateContextAware(string(data))
	}
	return total
}

func estimateFixed(messages []format.CoreMessage, charsPerToken float64) float64 {
	var total float64
	for _, m := range messages {
		data, _ := json.Marshal(m.Content)
		total += float64(len(data)) / charsPerToken
	}
	return total
}

// estimateContextAware estimates token count by segmenting text by character
// type and applying per-type chars/token ratios:
//
//	CJK (U+4E00–U+9FFF, U+3400–U+4DBF, U+F900–U+FAFF): 0.75
//	Code (JSON brackets, braces, operators dominating): 1.3
//	Latin prose (ASCII letters + spaces): 3.8
//	Other (symbols, emoji, unknown): 2.0
func estimateContextAware(text string) float64 {
	if len(text) == 0 {
		return 0
	}

	type segType int
	const (
		segCJK   segType = iota
		segCode
		segLatin
		segOther
	)

	charsPerToken := func(t segType) float64 {
		switch t {
		case segCJK:
			return 0.75
		case segCode:
			return 1.3
		case segLatin:
			return 3.8
		default:
			return 2.0
		}
	}

	classify := func(r rune) segType {
		switch {
		case r >= 0x4E00 && r <= 0x9FFF:
			return segCJK
		case r >= 0x3400 && r <= 0x4DBF:
			return segCJK
		case r >= 0xF900 && r <= 0xFAFF:
			return segCJK
		case r >= 0x3000 && r <= 0x303F: // CJK punctuation
			return segCJK
		case r == '{' || r == '}' || r == '[' || r == ']' || r == '"' || r == ':':
			return segCode
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r == ' ':
			return segLatin
		default:
			// Heuristic: if surrounded by code-like chars, treat as code.
			return segOther
		}
	}

	var total float64
	var curType segType = -1
	var segLen int

	flush := func() {
		if segLen > 0 && curType >= 0 {
			total += float64(segLen) / charsPerToken(curType)
		}
		segLen = 0
		curType = -1
	}

	for _, r := range text {
		t := classify(r)
		if t != curType || segLen > 256 {
			flush()
			curType = t
		}
		segLen++
	}
	flush()

	return total
}

// Compile-time interface checks.
var (
	_ plugin.Plugin          = (*Plugin)(nil)
	_ plugin.MessageRewriter = (*Plugin)(nil)
)
