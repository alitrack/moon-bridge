// Package skillinjector retrieves relevant skills from a local SKILL.md
// repository and injects them into the system prompt on each request.
//
// Skills are stored in ~/.moonbridge/skills/<name>/SKILL.md, compatible with
// the Anthropic Agent Skills format (YAML frontmatter + markdown body).
//
// Default: disabled. Must be explicitly enabled per model or globally.
package skillinjector

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"moonbridge/internal/config"
	"moonbridge/internal/extension/plugin"
	"moonbridge/internal/format"
)

const PluginName = "skill_injector"

// Config for the skill injector extension.
type Config struct {
	// SkillsDir is the directory containing skill subdirectories.
	// Default: ~/.moonbridge/skills/
	SkillsDir string `json:"skills_dir,omitempty" yaml:"skills_dir"`
	// TopK is the maximum number of skills to inject per request. Default: 3.
	TopK int `json:"top_k,omitempty" yaml:"top_k"`
	// RetrievalMode: "template" (keyword matching) or "embedding" (requires model).
	// Default: "template".
	RetrievalMode string `json:"retrieval_mode,omitempty" yaml:"retrieval_mode"`
}

// Skill represents a parsed SKILL.md.
type Skill struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Content     string `json:"content"`
	Category    string `json:"category,omitempty"`
	FilePath    string `json:"file_path"`
}

// skillIndex holds the parsed skill library in memory.
type skillIndex struct {
	mu     sync.RWMutex
	skills []Skill
	dir    string
}

type Plugin struct {
	plugin.BasePlugin
	cfg           *Config
	appCfg        config.Config
	currentConfig func() config.Config
	log           *slog.Logger
	index         *skillIndex
}

func NewPlugin() *Plugin {
	return &Plugin{index: &skillIndex{}}
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
	if p.cfg.SkillsDir == "" {
		home, _ := os.UserHomeDir()
		p.cfg.SkillsDir = filepath.Join(home, ".moonbridge", "skills")
	} else {
		p.cfg.SkillsDir = expandTilde(p.cfg.SkillsDir)
	}
	if p.cfg.TopK <= 0 {
		p.cfg.TopK = 3
	}
	if p.cfg.TopK > 10 {
		p.cfg.TopK = 10
	}
	if p.cfg.RetrievalMode == "" {
		p.cfg.RetrievalMode = "template"
	}
	p.appCfg = ctx.AppConfig
	p.currentConfig = ctx.CurrentConfig
	p.log = ctx.Logger

	p.index.dir = p.cfg.SkillsDir
	if err := p.index.reload(); err != nil {
		p.log.Warn("skill_injector: failed to load skills", "dir", p.cfg.SkillsDir, "error", err)
		// Non-fatal: plugin works with empty index
	} else {
		p.log.Info("skill_injector initialized",
			"dir", p.cfg.SkillsDir,
			"top_k", p.cfg.TopK,
			"mode", p.cfg.RetrievalMode,
			"skills", len(p.index.skills),
		)
	}
	return nil
}

func (p *Plugin) EnabledForModel(model string) bool {
	return p.currentConfig().ExtensionEnabled(PluginName, model)
}

// MutateCoreRequest implements plugin.CoreRequestMutator.
// Scans the last user message for a task description, retrieves relevant
// skills, and injects them into the system prompt.
func (p *Plugin) MutateCoreRequest(ctx context.Context, req *format.CoreRequest) {
	if req == nil {
		return
	}
	if !p.EnabledForModel(req.Model) {
		return
	}
	if p.cfg.TopK <= 0 {
		return
	}

	// Extract task description from the last user message.
	taskDesc := extractTaskDescription(req.Messages)
	if taskDesc == "" {
		return
	}

	// Retrieve relevant skills.
	skills := p.index.retrieve(taskDesc, p.cfg.TopK, p.cfg.RetrievalMode)
	if len(skills) == 0 {
		p.log.Info("skill_injector: no matches, fallback to top", "model", req.Model)
		skills = p.index.top(p.cfg.TopK)
	}
	if len(skills) == 0 {
		return
	}

	// Build skill block to inject.
	var sb strings.Builder
	sb.WriteString("\n\n<!-- skill-injector:start -->\n## Relevant Skills\n\n")
	for _, s := range skills {
		sb.WriteString(fmt.Sprintf("### %s\n%s\n\n%s\n\n",
			s.Name, s.Description, s.Content))
	}
	sb.WriteString("<!-- skill-injector:end -->")

	// Append to system prompt (append, not replace — safe default).
	// System is a list of content blocks; append to the last text block or
	// add a new block.
	injected := false
	for i := range req.System {
		if req.System[i].Type == "text" {
			req.System[i].Text += sb.String()
			injected = true
			break
		}
	}
	if !injected {
		req.System = append(req.System, format.CoreContentBlock{
			Type: "text",
			Text: sb.String(),
		})
	}

	p.log.Info("skill_injector: injected",
		"count", len(skills),
		"model", req.Model,
		"names", skillNames(skills),
	)
}

// Compile-time interface checks
var (
	_ plugin.Plugin             = (*Plugin)(nil)
	_ plugin.CoreRequestMutator = (*Plugin)(nil)
)

// expandTilde replaces a leading ~ with the user's home directory.
func expandTilde(path string) string {
	if strings.HasPrefix(path, "~") {
		home, _ := os.UserHomeDir()
		return filepath.Join(home, path[1:])
	}
	return path
}

// --- Skill Index ---

func (idx *skillIndex) reload() error {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	idx.skills = idx.skills[:0]
	entries, err := os.ReadDir(idx.dir)
	if err != nil {
		return fmt.Errorf("read skills dir: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		skillDir := filepath.Join(idx.dir, entry.Name())
		skillMDPath := filepath.Join(skillDir, "SKILL.md")
		skill, err := parseSkillMD(skillMDPath)
		if err != nil {
			continue
		}
		idx.skills = append(idx.skills, *skill)
	}
	return nil
}

func (idx *skillIndex) retrieve(taskDesc string, topK int, mode string) []Skill {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if len(idx.skills) == 0 {
		return nil
	}

	switch mode {
	case "template":
		return idx.templateRetrieve(taskDesc, topK)
	default:
		return idx.templateRetrieve(taskDesc, topK)
	}
}

// templateRetrieve matches skills by keyword overlap with the task description.
func (idx *skillIndex) templateRetrieve(taskDesc string, topK int) []Skill {
	tokens := tokenize(taskDesc)
	if len(tokens) == 0 {
		// Fallback: return top-K by name length (arbitrary but stable)
		if topK > len(idx.skills) {
			topK = len(idx.skills)
		}
		return idx.skills[:topK]
	}

	type scored struct {
		skill Skill
		score int
	}
	var scoredSkills []scored

	for _, s := range idx.skills {
		score := countMatches(tokens, s.Name, s.Description)
		if score > 0 {
			scoredSkills = append(scoredSkills, scored{skill: s, score: score})
		}
	}

	// Sort by score descending, stable sort preserves load order for ties.
	for i := 0; i < len(scoredSkills); i++ {
		for j := i + 1; j < len(scoredSkills); j++ {
			if scoredSkills[j].score > scoredSkills[i].score {
				scoredSkills[i], scoredSkills[j] = scoredSkills[j], scoredSkills[i]
			}
		}
	}

	if topK > len(scoredSkills) {
		topK = len(scoredSkills)
	}

	result := make([]Skill, topK)
	for i := 0; i < topK; i++ {
		result[i] = scoredSkills[i].skill
	}
	return result
}

// top returns the first topK skills (stable order). Used as fallback
// when keyword matching finds no results.
func (idx *skillIndex) top(topK int) []Skill {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	if topK > len(idx.skills) {
		topK = len(idx.skills)
	}
	result := make([]Skill, topK)
	copy(result, idx.skills)
	return result
}

// --- SKILL.md Parser ---

func parseSkillMD(path string) (*Skill, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	var lines []string
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	text := strings.Join(lines, "\n")

	// Find YAML frontmatter delimiters.
	if !strings.HasPrefix(text, "---") {
		return nil, fmt.Errorf("no YAML frontmatter")
	}
	endIdx := strings.Index(text[3:], "\n---")
	if endIdx == -1 {
		return nil, fmt.Errorf("unclosed YAML frontmatter")
	}
	endIdx += 3 // account for the offset

	fmText := strings.TrimSpace(text[3:endIdx])
	body := strings.TrimSpace(text[endIdx+4:])

	// Parse YAML frontmatter (simple line-by-line for fields we care about).
	fm := parseSimpleYAML(fmText)

	name := strings.TrimSpace(fm["name"])
	desc := strings.TrimSpace(fm["description"])
	if name == "" || desc == "" {
		return nil, fmt.Errorf("missing name or description in %s", path)
	}

	return &Skill{
		Name:        name,
		Description: desc,
		Content:     body,
		Category:    strings.TrimSpace(fm["category"]),
		FilePath:    path,
	}, nil
}

// parseSimpleYAML extracts top-level key: value pairs from a YAML frontmatter block.
func parseSimpleYAML(text string) map[string]string {
	result := make(map[string]string)
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Remove surrounding quotes if present.
		val = strings.Trim(val, "\"'")
		result[key] = val
	}
	return result
}

// --- Helpers ---

// extractTaskDescription extracts text from the last user message.
func extractTaskDescription(messages []format.CoreMessage) string {
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role != "user" {
			continue
		}
		var parts []string
		for _, block := range messages[i].Content {
			if block.Type == "text" {
				parts = append(parts, block.Text)
			}
		}
		return strings.Join(parts, "\n")
	}
	return ""
}

// tokenize splits text into lowercase tokens for keyword matching.
func tokenize(text string) []string {
	raw := strings.Fields(strings.ToLower(text))
	// Deduplicate
	seen := make(map[string]bool)
	var tokens []string
	for _, t := range raw {
		// Skip very short tokens
		if len(t) < 3 {
			continue
		}
		t = strings.Trim(t, ",.;:!?\"'()[]{}")
		if !seen[t] {
			seen[t] = true
			tokens = append(tokens, t)
		}
	}
	return tokens
}

// countMatches counts how many tokens from the input match the skill name or description.
func countMatches(tokens []string, name, desc string) int {
	skillTokens := tokenize(name + " " + desc)
	seen := make(map[string]bool)
	for _, t := range skillTokens {
		seen[t] = true
	}
	count := 0
	for _, t := range tokens {
		if seen[t] {
			count++
		}
	}
	return count
}

func skillNames(skills []Skill) string {
	names := make([]string, len(skills))
	for i, s := range skills {
		names[i] = s.Name
	}
	return strings.Join(names, ", ")
}
