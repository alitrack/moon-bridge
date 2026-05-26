// Package responsestore provides response storage for Codex sessions.
// Stores recent responses in an in-memory LRU cache.
// Previous_response_id bridging requires CoreRequest field addition (future work).
package responsestore

import (
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

type Plugin struct {
	plugin.BasePlugin
	cfg           *Config
	appCfg        config.Config
	currentConfig func() config.Config
	mu            sync.RWMutex
	store         map[string]*storedResponse
}

func NewPlugin() *Plugin {
	return &Plugin{store: make(map[string]*storedResponse)}
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
	p.mu.Lock()
	defer p.mu.Unlock()

	now := time.Now()
	for id, entry := range p.store {
		if now.Sub(entry.storedAt) > time.Duration(p.cfg.TTLSeconds)*time.Second {
			delete(p.store, id)
		}
	}
	if len(p.store) >= p.cfg.MaxEntries {
		for id := range p.store {
			delete(p.store, id)
			break
		}
	}
	p.store[resp.ID] = &storedResponse{output: resp.Output, storedAt: now}
}

var (
	_ plugin.Plugin               = (*Plugin)(nil)
	_ plugin.ResponsePostProcessor = (*Plugin)(nil)
)
