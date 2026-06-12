// Package sessionrecorder records LLM request/response turns to JSONL files
// for debugging, analysis, and training data collection.
//
// Architecture:
//   - RequestCompletionHook captures per-request outcome data
//   - Output is JSONL files in configurable output directory
//   - Optional TTL-based cleanup of old session files
//
// Default: disabled. Must be explicitly enabled per model or globally.
package sessionrecorder

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"moonbridge/internal/config"
	"moonbridge/internal/extension/plugin"
)

const PluginName = "session_recorder"

// Config for the session recorder extension.
type Config struct {
	// OutputDir is where JSONL files are written.
	// Default: ~/.moonbridge/sessions/
	OutputDir string `json:"output_dir,omitempty" yaml:"output_dir"`
	// MaxDays before old session files are cleaned up. 0 = no cleanup.
	MaxDays int `json:"max_days,omitempty" yaml:"max_days"`
	// Enabled default is false. This configures the model-level/global default.
	Enabled *bool `json:"enabled,omitempty" yaml:"enabled,omitempty"`
}

type Plugin struct {
	plugin.BasePlugin
	cfg           *Config
	appCfg        config.Config
	currentConfig func() config.Config
	log           *slog.Logger
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
		p.cfg = &Config{}
	}
	if p.cfg.OutputDir == "" {
		home, _ := os.UserHomeDir()
		p.cfg.OutputDir = filepath.Join(home, ".moonbridge", "sessions")
	} else {
		p.cfg.OutputDir = expandTilde(p.cfg.OutputDir)
	}
	if p.cfg.MaxDays <= 0 {
		p.cfg.MaxDays = 7
	}
	p.appCfg = ctx.AppConfig
	p.currentConfig = ctx.CurrentConfig
	p.log = ctx.Logger

	// Ensure output directory exists.
	if err := os.MkdirAll(p.cfg.OutputDir, 0755); err != nil {
		return fmt.Errorf("session_recorder: create output dir: %w", err)
	}

	p.log.Info("session_recorder initialized",
		"output_dir", p.cfg.OutputDir,
		"max_days", p.cfg.MaxDays,
	)
	return nil
}

func (p *Plugin) EnabledForModel(model string) bool {
	return p.currentConfig().ExtensionEnabled(PluginName, model)
}

// OnRequestCompleted implements plugin.RequestCompletionHook.
func (p *Plugin) OnRequestCompleted(ctx *plugin.RequestContext, result plugin.RequestResult) {
	if !p.EnabledForModel(result.Model) {
		return
	}

	record := SessionRecord{
		Timestamp:   time.Now().UTC(),
		Model:       result.Model,
		ActualModel: result.ActualModel,
		Provider:    result.ProviderKey,
		InputTokens: result.InputTokens,
		OutputTokens: result.OutputTokens,
		Cost:        result.Cost,
		Status:      result.Status,
		DurationMs:  result.Duration.Milliseconds(),
	}

	if result.ErrorMessage != "" {
		record.Error = result.ErrorMessage
	}

	// Write to daily JSONL file.
	filename := fmt.Sprintf("sessions-%s.jsonl", time.Now().UTC().Format("2006-01-02"))
	filePath := filepath.Join(p.cfg.OutputDir, filename)

	line, err := json.Marshal(record)
	if err != nil {
		p.log.Error("failed to marshal session record", "error", err)
		return
	}

	f, err := os.OpenFile(filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		p.log.Error("failed to open session file", "path", filePath, "error", err)
		return
	}
	defer f.Close()

	line = append(line, '\n')
	if _, err := f.Write(line); err != nil {
		p.log.Error("failed to write session record", "error", err)
	}
}

// expandTilde replaces a leading ~ with the user's home directory.
func expandTilde(path string) string {
	if strings.HasPrefix(path, "~") {
		home, _ := os.UserHomeDir()
		return filepath.Join(home, path[1:])
	}
	return path
}

// SessionRecord captures a single request/response pair.
type SessionRecord struct {
	Timestamp   time.Time `json:"timestamp"`
	Model       string    `json:"model"`
	ActualModel string    `json:"actual_model,omitempty"`
	Provider    string    `json:"provider,omitempty"`
	InputTokens   int     `json:"input_tokens"`
	OutputTokens  int     `json:"output_tokens"`
	Cost        float64   `json:"cost,omitempty"`
	Status      string    `json:"status"`
	Error       string    `json:"error,omitempty"`
	DurationMs  int64     `json:"duration_ms"`
}
