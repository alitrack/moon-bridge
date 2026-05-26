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
	MaxConsecutiveTools int `json:"max_consecutive_tools,omitempty" yaml:"max_consecutive_tools"`
	HardLimit           int `json:"hard_limit,omitempty" yaml:"hard_limit"`
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
	_ plugin.Plugin         = (*Plugin)(nil)
	_ plugin.RequestMutator = (*Plugin)(nil)
)
