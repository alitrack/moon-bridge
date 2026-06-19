// Package circuitbreaker prevents runaway tool-call loops by tracking
// consecutive tool_use blocks per session and injecting a reflection
// prompt into system messages when the count exceeds a threshold.
package circuitbreaker

import (
	"moonbridge/internal/config"
	"moonbridge/internal/extension/plugin"
	"moonbridge/internal/format"
)

const PluginName = "circuit_breaker"

// sessionStateKey is used to store per-session state in RequestContext.SessionData.
const sessionStateKey = "circuit_breaker_state"

type Config struct {
	MaxConsecutiveTools int  `json:"max_consecutive_tools,omitempty" yaml:"max_consecutive_tools"`
	HardLimit           int  `json:"hard_limit,omitempty" yaml:"hard_limit"`
	// CachePreserving enables prefix-cache-safe behavior for DeepSeek.
	// When true (default): skip tool-call deduplication (dedup removes
	// message blocks mid-history, breaking DeepSeek's prefix KV cache).
	// When false: legacy behavior — dedup consecutive identical tool calls.
	// Default: true (nil = true).
	CachePreserving *bool `json:"cache_preserving,omitempty" yaml:"cache_preserving"`
}

type sessionState struct {
	consecutiveTools int
	warned           bool
}

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
	if p.cfg.MaxConsecutiveTools <= 0 {
		p.cfg.MaxConsecutiveTools = 20
	}
	if p.cfg.HardLimit <= 0 {
		p.cfg.HardLimit = 30
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

// getState returns the per-session state for this request.
// Uses RequestContext.SessionData so concurrent users don't mix.
func (p *Plugin) getState(ctx *plugin.RequestContext) *sessionState {
	if ctx.SessionData == nil {
		ctx.SessionData = make(map[string]any)
	}
	raw, ok := ctx.SessionData[sessionStateKey]
	if !ok {
		state := &sessionState{}
		ctx.SessionData[sessionStateKey] = state
		return state
	}
	// The raw value is from session initialization which stores *sync.Mutex
	// guarded maps. Here we use a pointer directly stored in SessionData.
	state, ok := raw.(*sessionState)
	if !ok {
		state = &sessionState{}
		ctx.SessionData[sessionStateKey] = state
	}
	return state
}

// MutateRequest implements plugin.RequestMutator.
// Tracks tool calls and injects warnings when limits are exceeded.
func (p *Plugin) MutateRequest(ctx *plugin.RequestContext, req *format.CoreRequest) {
	// Count tool_use blocks in the last assistant message
	toolCount := 0
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role != "assistant" {
			break
		}
		for _, block := range req.Messages[i].Content {
			if block.Type == "tool_use" {
				toolCount++
			}
		}
	}

	state := p.getState(ctx)

	// Reset if no tool calls this turn
	if toolCount == 0 {
		state.consecutiveTools = 0
		state.warned = false
		return
	}

	state.consecutiveTools += toolCount

	if state.consecutiveTools >= p.cfg.HardLimit && state.warned {
		req.System = append(req.System, format.CoreContentBlock{
			Type: "text",
			Text: "[CRITICAL: You have made " + itoa(state.consecutiveTools) + " consecutive tool calls. STOP calling tools immediately. Provide your best answer NOW based on the information you already have. Do NOT call any more tools.]",
		})
		state.consecutiveTools = 0
		state.warned = false
	} else if state.consecutiveTools >= p.cfg.MaxConsecutiveTools && !state.warned {
		req.System = append(req.System, format.CoreContentBlock{
			Type: "text",
			Text: "[Note: " + itoa(state.consecutiveTools) + " tool calls in a row. Consider whether you have enough information to answer. If so, answer now without calling more tools.]",
		})
		state.warned = true
	}
}

// RewriteMessages implements plugin.MessageRewriter.
// Detects and collapses consecutive identical tool_call blocks to prevent
// DeepSeek/Claude from looping on repeated function calls.
// When CachePreserving is true (default), deduplication is SKIPPED because
// removing message blocks mid-history breaks DeepSeek's prefix KV cache.
func (p *Plugin) RewriteMessages(ctx *plugin.RequestContext, messages []format.CoreMessage) []format.CoreMessage {
	// Skip dedup in cache-preserving mode: removing message blocks mid-history
	// shifts byte offsets and breaks DeepSeek's prefix cache.
	if p.cfg.CachePreserving != nil && *p.cfg.CachePreserving {
		return messages
	}
	// Dedup: collapse consecutive identical tool_use+tool_result pairs
	return deduplicateToolCalls(messages)
}

// deduplicateToolCalls collapses consecutive identical tool call + result
// blocks. DeepSeek and Claude sometimes repeat the same function call
// (same name + args, different call_id) across multiple turns. Removing
// the redundant history prevents the model from seeing its own repetition
// and reinforcing the loop.
func deduplicateToolCalls(messages []format.CoreMessage) []format.CoreMessage {
	if len(messages) == 0 {
		return messages
	}

	type toolCallSig struct {
		name string
		args string
	}

	result := make([]format.CoreMessage, 0, len(messages))
	i := 0

	for i < len(messages) {
		msg := messages[i]

		// Check if this is an assistant message with tool_calls
		if msg.Role != "assistant" || !hasToolUses(msg) {
			result = append(result, msg)
			i++
			continue
		}

		// Collect this assistant's tool calls
		currentSigs := extractToolCallSigs(msg)

		// Find end of tool results following this assistant
		j := i + 1
		for j < len(messages) && messages[j].Role == "tool" {
			j++
		}

		// Keep this assistant + its tool results
		for k := i; k < j; k++ {
			result = append(result, messages[k])
		}

		// Look ahead for consecutive identical tool call blocks
		next := j
		skipped := false
		for next < len(messages) {
			if messages[next].Role != "assistant" || !hasToolUses(messages[next]) {
				break
			}
			nextSigs := extractToolCallSigs(messages[next])
			if !toolCallSigsEqual(currentSigs, nextSigs) {
				break
			}
			// Found duplicate block — skip this assistant + its tool results
			skipped = true
			next++
			for next < len(messages) && messages[next].Role == "tool" {
				next++
			}
		}

		i = next
		_ = skipped
	}
	return result
}

func hasToolUses(msg format.CoreMessage) bool {
	for _, block := range msg.Content {
		if block.Type == "tool_use" {
			return true
		}
	}
	return false
}

func extractToolCallSigs(msg format.CoreMessage) []struct {
	name string
	args string
} {
	var sigs []struct {
		name string
		args string
	}
	for _, block := range msg.Content {
		if block.Type == "tool_use" {
			sigs = append(sigs, struct {
				name string
				args string
			}{block.ToolName, string(block.ToolInput)})
		}
	}
	return sigs
}

func toolCallSigsEqual(a, b []struct {
	name string
	args string
}) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].name != b[i].name || a[i].args != b[i].args {
			return false
		}
	}
	return true
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

var (
	_ plugin.Plugin          = (*Plugin)(nil)
	_ plugin.RequestMutator  = (*Plugin)(nil)
	_ plugin.MessageRewriter = (*Plugin)(nil)
)
