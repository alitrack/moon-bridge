package prompt_sanitizer

import (
	"context"
	"moonbridge/internal/config"
	"moonbridge/internal/extension/plugin"
	"moonbridge/internal/format"
	"regexp"
	"strings"
)

const PluginName = "prompt_sanitizer"

// Defaults cover Claude Code v2.1.91–v2.1.196 fingerprint encoding.
// Config-driven: override via config.yml when Claude Code changes its fingerprint.
var defaultCharMap = []CharPair{
	{"\u2019", "'"}, // U+2019 right single quotation mark — known Chinese domain
	{"\u02BC", "'"}, // U+02BC modifier letter apostrophe  — AI lab keyword
	{"\u02B9", "'"}, // U+02B9 modifier letter prime       — both domain + lab
}

var defaultDatePatterns = []DatePattern{
	{`(\d{4})/(\d{2})/(\d{2})`, "$1-$2-$3"}, // cnTZ: 2026/07/01 → 2026-07-01
}

type CharPair struct {
	From string `json:"from" yaml:"from"`
	To   string `json:"to" yaml:"to"`
}

type DatePattern struct {
	From string `json:"from" yaml:"from"`
	To   string `json:"to" yaml:"to"`
}

type Config struct {
	CharMap      []CharPair    `json:"char_map,omitempty" yaml:"char_map,omitempty"`
	DatePatterns []DatePattern `json:"date_patterns,omitempty" yaml:"date_patterns,omitempty"`
}

type dateRule struct {
	re *regexp.Regexp
	to string
}

type Plugin struct {
	plugin.BasePlugin
	cfg           *Config
	currentConfig func() config.Config

	apostropheReplacer *strings.Replacer
	dateRules          []dateRule
}

func NewPlugin() *Plugin { return &Plugin{} }

func (p *Plugin) Name() string { return PluginName }

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
		p.cfg = &Config{}
	}
	p.currentConfig = ctx.CurrentConfig

	charMap := p.cfg.CharMap
	if len(charMap) == 0 {
		charMap = defaultCharMap
	}
	args := make([]string, 0, len(charMap)*2)
	for _, cp := range charMap {
		args = append(args, cp.From, cp.To)
	}
	p.apostropheReplacer = strings.NewReplacer(args...)

	patterns := p.cfg.DatePatterns
	if len(patterns) == 0 {
		patterns = defaultDatePatterns
	}
	p.dateRules = make([]dateRule, 0, len(patterns))
	for _, dp := range patterns {
		re, err := regexp.Compile(dp.From)
		if err != nil {
			return err
		}
		p.dateRules = append(p.dateRules, dateRule{re: re, to: dp.To})
	}

	return nil
}

func (p *Plugin) EnabledForModel(model string) bool {
	return p.currentConfig().ExtensionEnabled(PluginName, model)
}

// MutateCoreRequest normalizes Claude Code fingerprint characters in CoreRequest.System.
// System lives on CoreRequest (not inside Messages) — CoreRequestMutator is the correct hook.
func (p *Plugin) MutateCoreRequest(ctx context.Context, req *format.CoreRequest) {
	if len(req.System) > 0 {
		p.sanitizeBlocks(req.System)
	}
	for i := range req.Messages {
		if req.Messages[i].Role == "system" {
			p.sanitizeBlocks(req.Messages[i].Content)
		}
	}
}

// RewriteMessages provides defense-in-depth for paths where system arrives
// as a role="system" message rather than CoreRequest.System.
func (p *Plugin) RewriteMessages(ctx *plugin.RequestContext, msgs []format.CoreMessage) []format.CoreMessage {
	for i := range msgs {
		if msgs[i].Role == "system" {
			p.sanitizeBlocks(msgs[i].Content)
		}
	}
	return msgs
}

func (p *Plugin) sanitizeBlocks(blocks []format.CoreContentBlock) {
	for i := range blocks {
		if blocks[i].Type == "text" {
			blocks[i].Text = p.normalize(blocks[i].Text)
		}
	}
}

func (p *Plugin) normalize(s string) string {
	s = p.apostropheReplacer.Replace(s)
	for _, r := range p.dateRules {
		s = r.re.ReplaceAllString(s, r.to)
	}
	return s
}

var (
	_ plugin.Plugin             = (*Plugin)(nil)
	_ plugin.CoreRequestMutator = (*Plugin)(nil)
	_ plugin.MessageRewriter    = (*Plugin)(nil)
)
