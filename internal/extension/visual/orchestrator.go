package visual

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"

	"log/slog"
	"moonbridge/internal/protocol/anthropic"
)

type Provider interface {
	CreateMessage(context.Context, anthropic.MessageRequest) (anthropic.MessageResponse, error)
	StreamMessage(context.Context, anthropic.MessageRequest) (anthropic.Stream, error)
}

type OrchestratorConfig struct {
	Upstream  Provider
	Client    VisionClient
	Visual    ClientConfig
	MaxRounds int
}

type Orchestrator struct {
	upstream  Provider
	client    VisionClient
	maxRounds int
}

func NewOrchestrator(cfg OrchestratorConfig) *Orchestrator {
	client := cfg.Client
	if client == nil {
		client = NewBridgeClient(cfg.Visual)
	}
	maxRounds := cfg.MaxRounds
	if maxRounds <= 0 {
		maxRounds = 4
	}
	return &Orchestrator{
		upstream:  cfg.Upstream,
		client:    client,
		maxRounds: maxRounds,
	}
}

func WrapProvider(upstream Provider, visualProvider Provider, model string, maxRounds int, maxTokens int) Provider {
	return NewOrchestrator(OrchestratorConfig{
		Upstream:  upstream,
		Visual:    ClientConfig{Provider: visualProvider, Model: model, MaxTokens: maxTokens},
		MaxRounds: maxRounds,
	})
}

func (o *Orchestrator) CreateMessage(ctx context.Context, req anthropic.MessageRequest) (anthropic.MessageResponse, error) {
	if o == nil || o.upstream == nil {
		return anthropic.MessageResponse{}, fmt.Errorf("visual upstream provider is nil")
	}
	req, availableImages := prepareRequestForVisual(req)
	log := slog.Default()
	for round := 0; round < o.maxRounds; round++ {
		resp, err := o.upstream.CreateMessage(ctx, req)
		if err != nil {
			return anthropic.MessageResponse{}, err
		}
		if resp.StopReason != "tool_use" {
			return resp, nil
		}

		toolUses, nonVisual := splitVisualToolUses(resp.Content)
		if len(nonVisual) > 0 || len(toolUses) == 0 {
			return resp, nil
		}

		toolResults := make([]anthropic.ContentBlock, 0, len(toolUses))
		for _, toolUse := range toolUses {
			result := o.executeVisualTool(ctx, toolUse, availableImages)
			toolResults = append(toolResults, anthropic.ContentBlock{
				Type:      "tool_result",
				ToolUseID: toolUse.ID,
				Content:   result,
			})
		}

		req.Messages = append(req.Messages, anthropic.Message{
			Role:    "assistant",
			Content: resp.Content,
		})
		req.Messages = append(req.Messages, anthropic.Message{
			Role:    "user",
			Content: toolResults,
		})
		req.ToolChoice = &anthropic.ToolChoice{Type: "auto"}
		log.Debug("Visual tool loop completed", "round", round+1, "tools_executed", len(toolUses))
	}
	return anthropic.MessageResponse{}, fmt.Errorf("visual loop exceeded max rounds (%d)", o.maxRounds)
}

func (o *Orchestrator) StreamMessage(ctx context.Context, req anthropic.MessageRequest) (anthropic.Stream, error) {
	if o == nil || o.upstream == nil {
		return nil, fmt.Errorf("visual upstream provider is nil")
	}
	req, availableImages := prepareRequestForVisual(req)
	log := slog.Default()
	var allEvents []anthropic.StreamEvent
	for round := 0; round < o.maxRounds; round++ {
		stream, err := o.upstream.StreamMessage(ctx, req)
		if err != nil {
			return nil, err
		}
		events, err := collectStream(stream)
		stream.Close()
		if err != nil {
			return nil, err
		}
		allEvents = events

		stopReason, lastUsage := streamStopReason(events)
		if stopReason != "tool_use" {
			if lastUsage != nil {
				allEvents = injectUsageIntoStart(allEvents, *lastUsage)
			}
			return &staticStream{events: allEvents}, nil
		}

		assistantContent := collectContentFromEvents(events)
		toolUses, nonVisual := splitVisualToolUses(assistantContent)
		if len(nonVisual) > 0 || len(toolUses) == 0 {
			if lastUsage != nil {
				allEvents = injectUsageIntoStart(allEvents, *lastUsage)
			}
			return &staticStream{events: allEvents}, nil
		}

		toolResults := make([]anthropic.ContentBlock, 0, len(toolUses))
		for _, toolUse := range toolUses {
			result := o.executeVisualTool(ctx, toolUse, availableImages)
			toolResults = append(toolResults, anthropic.ContentBlock{
				Type:      "tool_result",
				ToolUseID: toolUse.ID,
				Content:   result,
			})
		}

		req.Messages = append(req.Messages, anthropic.Message{
			Role:    "assistant",
			Content: assistantContent,
		})
		req.Messages = append(req.Messages, anthropic.Message{
			Role:    "user",
			Content: toolResults,
		})
		req.ToolChoice = &anthropic.ToolChoice{Type: "auto"}
		log.Debug("Visual stream tool loop completed", "round", round+1, "tools_executed", len(toolUses))
	}
	return nil, fmt.Errorf("stream visual loop exceeded max rounds (%d)", o.maxRounds)
}

func prepareRequestForVisual(req anthropic.MessageRequest) (anthropic.MessageRequest, []ImageInput) {
	availableImages := make([]ImageInput, 0)
	for messageIndex := range req.Messages {
		content := req.Messages[messageIndex].Content
		if len(content) == 0 {
			continue
		}
		rewritten := make([]anthropic.ContentBlock, 0, len(content))
		for _, block := range content {
			if block.Type != "image" || block.Source == nil {
				rewritten = append(rewritten, block)
				continue
			}
			image, ok := imageInputFromAnthropicSource(block.Source)
			if !ok {
				continue
			}
			availableImages = append(availableImages, image)
			rewritten = append(rewritten, anthropic.ContentBlock{
				Type: "text",
				Text: visualAttachmentText(len(availableImages)),
			})
		}
		req.Messages[messageIndex].Content = rewritten
	}
	return req, availableImages
}

// StripImagesFromAnthropic strips image blocks from an anthropic MessageRequest and
// replaces them with text placeholders. Returns the stripped request and whether
// any images were found and stripped. Unlike prepareRequestForVisual, this does not
// return the extracted images (the caller doesn't need them for streaming).
func StripImagesFromAnthropic(req anthropic.MessageRequest) (anthropic.MessageRequest, bool) {
	modified := false
	newReq, images := prepareRequestForVisual(req)
	_ = images
	if len(images) > 0 {
		modified = true
	}
	return newReq, modified
}

func imageInputFromAnthropicSource(source *anthropic.ImageSource) (ImageInput, bool) {
	if source == nil {
		return ImageInput{}, false
	}
	switch source.Type {
	case "url":
		if strings.TrimSpace(source.URL) == "" {
			return ImageInput{}, false
		}
		return ImageInput{URL: strings.TrimSpace(source.URL)}, true
	case "base64":
		if strings.TrimSpace(source.Data) == "" {
			return ImageInput{}, false
		}
		return ImageInput{Data: source.Data, MimeType: source.MediaType}, true
	default:
		if strings.TrimSpace(source.URL) != "" {
			return ImageInput{URL: strings.TrimSpace(source.URL)}, true
		}
		if strings.TrimSpace(source.Data) != "" {
			return ImageInput{Data: source.Data, MimeType: source.MediaType}, true
		}
		return ImageInput{}, false
	}
}

func visualAttachmentText(index int) string {
	return fmt.Sprintf("[Image #%d is available to Visual Brief and Visual QA. Use image_refs [\"Image #%d\"] or omit image fields to analyze attached images.]", index, index)
}

func (o *Orchestrator) executeVisualTool(ctx context.Context, toolUse anthropic.ContentBlock, availableImages []ImageInput) string {
	request, err := analysisRequestFromToolUse(toolUse, availableImages)
	if err != nil {
		return "Visual error: " + err.Error()
	}
	result, err := o.client.Analyze(ctx, request)
	if err != nil {
		slog.Default().Warn("Visual tool execution failed", "tool", toolUse.Name, "error", err)
		return "Visual error: " + err.Error()
	}
	slog.Default().Info("Visual tool executed", "tool", toolUse.Name, "images", len(request.Images))
	switch toolUse.Name {
	case ToolVisualBrief:
		return "Visual Brief result:\n" + strings.TrimSpace(result)
	case ToolVisualQA:
		return "Visual QA result:\n" + strings.TrimSpace(result)
	default:
		return strings.TrimSpace(result)
	}
}

type briefInput struct {
	ImageURL  string       `json:"image_url,omitempty"`
	ImageURLs []string     `json:"image_urls,omitempty"`
	ImageRefs []string     `json:"image_refs,omitempty"`
	Images    []ImageInput `json:"images,omitempty"`
	Context   string       `json:"context,omitempty"`
	Focus     string       `json:"focus,omitempty"`
}

type qaInput struct {
	Question           string             `json:"question,omitempty"`
	ImageURL           string             `json:"image_url,omitempty"`
	ImageURLs          []string           `json:"image_urls,omitempty"`
	ImageRefs          []string           `json:"image_refs,omitempty"`
	Images             []ImageInput       `json:"images,omitempty"`
	PriorVisualContext string             `json:"prior_visual_context,omitempty"`
	Context            string             `json:"context,omitempty"`
	Conversation       []ConversationTurn `json:"conversation,omitempty"`
}

func analysisRequestFromToolUse(toolUse anthropic.ContentBlock, availableImages []ImageInput) (AnalysisRequest, error) {
	switch toolUse.Name {
	case ToolVisualBrief:
		var input briefInput
		if err := json.Unmarshal(toolUse.Input, &input); err != nil {
			return AnalysisRequest{}, fmt.Errorf("parse visual_brief input: %w", err)
		}
		images := normalizeImages(input.ImageURL, input.ImageURLs, input.Images, input.ImageRefs, availableImages)
		if len(images) == 0 {
			return AnalysisRequest{}, fmt.Errorf("visual_brief requires valid image URLs/data/images or attached images")
		}
		return AnalysisRequest{
			Tool:   ToolVisualBrief,
			Prompt: buildBriefPrompt(input),
			Images: images,
		}, nil
	case ToolVisualQA:
		var input qaInput
		if err := json.Unmarshal(toolUse.Input, &input); err != nil {
			return AnalysisRequest{}, fmt.Errorf("parse visual_qa input: %w", err)
		}
		if strings.TrimSpace(input.Question) == "" {
			return AnalysisRequest{}, fmt.Errorf("visual_qa requires question")
		}
		return AnalysisRequest{
			Tool:   ToolVisualQA,
			Prompt: buildQAPrompt(input),
			Images: normalizeImages(input.ImageURL, input.ImageURLs, input.Images, input.ImageRefs, availableImages),
		}, nil
	default:
		return AnalysisRequest{}, fmt.Errorf("unknown visual tool %q", toolUse.Name)
	}
}

// visualMode represents one of the five scene-specific analysis modes.
// Priority order (highest→lowest): modeErrorLog > modeChart > modeIssue > modeUILayout > modeOCR > modeDefault.
// Inspired by the OpenCode Observer plugin's multi-scene design (Peng Qian, Data Leads Future).
type visualMode int

const (
	modeDefault  visualMode = iota
	modeErrorLog            // C: error stacks, crash logs, exceptions
	modeChart               // E: charts, data visualization
	modeIssue               // B: bug marks, red boxes, arrows
	modeUILayout            // A: page/UI restoration, pixel-level
	modeOCR                 // D: text/conversation extraction
)

// modePriority labels for debug logging.
var modeNames = map[visualMode]string{
	modeDefault:  "DEFAULT",
	modeErrorLog: "ERROR_LOG",
	modeChart:    "CHART",
	modeIssue:    "ISSUE",
	modeUILayout: "UI_LAYOUT",
	modeOCR:      "OCR",
}

// buildBriefPrompt builds a scene-aware prompt for the vision model.
// It detects the most likely scene from focus+context signals and appends
// specialized output instructions. Priority: error > chart > issue > UI > OCR > default.
func buildBriefPrompt(input briefInput) string {
	mode := detectVisualMode(input.Focus, input.Context)

	var b strings.Builder
	switch mode {
	case modeErrorLog:
		b.WriteString("You are analyzing an error/failure screenshot for a coding agent.\n")
		b.WriteString("Extract ALL text EXACTLY — every line, every symbol, every error code.\n")
		b.WriteString("Preserve stack trace hierarchy, line numbers, file paths, and exception types.\n")
		b.WriteString("DO NOT paraphrase or summarize the error. The main agent needs the raw text.\n")
	case modeChart:
		b.WriteString("You are analyzing a chart/data visualization screenshot.\n")
		b.WriteString("Extract: chart type, axis labels and ranges, data point values/trends, key metrics, anomalies.\n")
		b.WriteString("Describe the data relationship clearly so the main agent can reason about it.\n")
	case modeIssue:
		b.WriteString("You are analyzing a screenshot with marked issues (red boxes, arrows, circles, highlights).\n")
		b.WriteString("For each mark: describe its exact location, what element it points to, the apparent problem (misalignment, wrong color, overflow, etc.), and a specific fix suggestion.\n")
	case modeUILayout:
		b.WriteString("You are analyzing a UI/page/design screenshot for pixel-level restoration.\n")
		b.WriteString("Describe: layout structure, element positions and sizes, color scheme, typography, spacing, interactive elements.\n")
		b.WriteString("If possible, use ASCII to represent the element layout — this helps the main agent recreate the page precisely.\n")
	case modeOCR:
		b.WriteString("You are extracting all text from a document/conversation screenshot.\n")
		b.WriteString("Output ALL text verbatim. Preserve speaker roles, text hierarchy (headings vs body vs captions), and content relationships.\n")
	default:
		b.WriteString("Provide a first-round visual brief for the main agent.\n")
	}

	if strings.TrimSpace(input.Context) != "" {
		b.WriteString("\nTask context:\n")
		b.WriteString(strings.TrimSpace(input.Context))
		b.WriteByte('\n')
	}
	if strings.TrimSpace(input.Focus) != "" {
		b.WriteString("\nFocus:\n")
		b.WriteString(strings.TrimSpace(input.Focus))
		b.WriteByte('\n')
	}

	// Common closing instruction (mode-specific additions already above).
	switch mode {
	case modeDefault:
		b.WriteString("\nReturn concise sections: overview, important visual details, any readable text/OCR, uncertainties, and useful Visual QA follow-ups. Do not solve beyond the visual evidence.")
	default:
		b.WriteString("\nReturn your analysis concisely. Call out any uncertainty. Suggest what a follow-up Visual QA should ask for deeper detail.")
	}

	slog.Default().Debug("Visual brief mode selected", "mode", modeNames[mode])
	return b.String()
}

// detectVisualMode determines the analysis mode from focus+context keywords.
// Priority: error (C) > chart (E) > issue (B) > UI (A) > OCR (D) > default.
// Signal words mirror the Observer plugin's design (Peng Qian, Data Leads Future).
func detectVisualMode(focus, context string) visualMode {
	combined := strings.ToLower(focus + " " + context)

	// Mode C — Error Log Extraction (highest priority)
	if hasAny(combined,
		"error", "stack", "crash", "exception", "traceback",
		"500", "404", "timeout", "panic", "fail",
		"stack trace", "stacktrace",
	) {
		return modeErrorLog
	}

	// Mode E — Chart/Data Visualization
	if hasAny(combined,
		"chart", "line chart", "bar chart", "pie chart",
		"scatter", "radar", "heatmap", "trend",
		"data viz", "visualization", "data visualization",
	) {
		return modeChart
	}

	// Mode B — Issue Location and Fix
	if hasAny(combined,
		"fix", "issue", "bug", "adjust", "wrong",
		"mark", "red box", "arrow", "circle",
		"skewed", "misalign", "overlap", "overflow",
		"redbox", "not align",
	) {
		return modeIssue
	}

	// Mode A — Page Restoration / UI Layout
	if hasAny(combined,
		"html", "page", "ui", "layout", "mockup", "design",
		"frontend", "css", "pixel", "restore",
		"reproduce", "recreate", "implement", "pixel-perfect",
		"figma", "xd", "component",
	) {
		return modeUILayout
	}

	// Mode D — Text/Conversation Extraction (OCR)
	if hasAny(combined,
		"ocr", "extract text", "transcribe", "read text",
		"conversation", "copywriting", "what was said",
	) {
		return modeOCR
	}

	return modeDefault
}

// hasAny returns true if the combined input contains any of the signal words.
// Matches whole-word and word-boundary for shorter signals to avoid false positives.
func hasAny(combined string, signals ...string) bool {
	for _, s := range signals {
		if strings.Contains(combined, s) {
			return true
		}
	}
	return false
}

func buildQAPrompt(input qaInput) string {
	var b strings.Builder
	b.WriteString("Answer this targeted visual clarification question for the main agent.\n\nQuestion:\n")
	b.WriteString(strings.TrimSpace(input.Question))
	b.WriteByte('\n')
	if strings.TrimSpace(input.Context) != "" {
		b.WriteString("\nTask context:\n")
		b.WriteString(strings.TrimSpace(input.Context))
		b.WriteByte('\n')
	}
	if strings.TrimSpace(input.PriorVisualContext) != "" {
		b.WriteString("\nPrior visual context:\n")
		b.WriteString(strings.TrimSpace(input.PriorVisualContext))
		b.WriteByte('\n')
	}
	if len(input.Conversation) > 0 {
		b.WriteString("\nVisual clarification history:\n")
		for _, turn := range input.Conversation {
			role := strings.TrimSpace(turn.Role)
			if role == "" {
				role = "note"
			}
			content := strings.TrimSpace(turn.Content)
			if content == "" {
				continue
			}
			b.WriteString(role)
			b.WriteString(": ")
			b.WriteString(content)
			b.WriteByte('\n')
		}
	}
	b.WriteString("\nAnswer directly, call out uncertainty, and say what extra image/detail would resolve ambiguity.")
	return b.String()
}

func normalizeImages(single string, urls []string, images []ImageInput, refs []string, availableImages []ImageInput) []ImageInput {
	normalized := make([]ImageInput, 0, len(urls)+len(images)+len(refs)+1)
	if image, ok := resolveImageValue(single, availableImages); ok {
		normalized = append(normalized, image)
	}
	for _, url := range urls {
		if image, ok := resolveImageValue(url, availableImages); ok {
			normalized = append(normalized, image)
		}
	}
	for _, ref := range refs {
		if image, ok := resolveAttachedImage(ref, availableImages); ok {
			normalized = append(normalized, image)
		}
	}
	for _, image := range images {
		if strings.TrimSpace(image.URL) != "" {
			if resolved, ok := resolveImageValue(image.URL, availableImages); ok {
				if resolved.Detail == "" {
					resolved.Detail = image.Detail
				}
				normalized = append(normalized, resolved)
			}
			continue
		}
		if !image.HasAnthropicSource() {
			continue
		}
		normalized = append(normalized, image)
	}
	if len(normalized) == 0 && len(availableImages) > 0 {
		normalized = append(normalized, availableImages...)
	}
	return normalized
}

func resolveImageValue(value string, availableImages []ImageInput) (ImageInput, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return ImageInput{}, false
	}
	if isSupportedImageURL(value) {
		return ImageInput{URL: value}, true
	}
	return resolveAttachedImage(value, availableImages)
}

func resolveAttachedImage(value string, availableImages []ImageInput) (ImageInput, bool) {
	index, ok := imageReferenceIndex(value)
	if !ok || index <= 0 || index > len(availableImages) {
		return ImageInput{}, false
	}
	return availableImages[index-1], true
}

var imageReferencePattern = regexp.MustCompile(`(?i)\bimage\s*#\s*(\d+)\b`)

func imageReferenceIndex(value string) (int, bool) {
	match := imageReferencePattern.FindStringSubmatch(strings.TrimSpace(value))
	if len(match) != 2 {
		return 0, false
	}
	index, err := strconv.Atoi(match[1])
	if err != nil {
		return 0, false
	}
	return index, true
}

func splitVisualToolUses(blocks []anthropic.ContentBlock) (visualUses, nonVisualToolUses []anthropic.ContentBlock) {
	for _, block := range blocks {
		if block.Type != "tool_use" {
			continue
		}
		if IsVisualTool(block.Name) {
			visualUses = append(visualUses, block)
		} else {
			nonVisualToolUses = append(nonVisualToolUses, block)
		}
	}
	return visualUses, nonVisualToolUses
}

func collectStream(stream anthropic.Stream) ([]anthropic.StreamEvent, error) {
	var events []anthropic.StreamEvent
	for {
		event, err := stream.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return events, err
		}
		events = append(events, event)
	}
	return events, nil
}

func streamStopReason(events []anthropic.StreamEvent) (string, *anthropic.Usage) {
	stopReason := "end_turn"
	var lastUsage *anthropic.Usage
	for i := len(events) - 1; i >= 0; i-- {
		if events[i].Type != "message_delta" {
			continue
		}
		if events[i].Delta.StopReason != "" {
			stopReason = events[i].Delta.StopReason
		}
		lastUsage = events[i].Usage
		break
	}
	return stopReason, lastUsage
}

type streamBlock struct {
	block anthropic.ContentBlock
	input strings.Builder
	text  strings.Builder
}

func collectContentFromEvents(events []anthropic.StreamEvent) []anthropic.ContentBlock {
	active := map[int]*streamBlock{}
	var order []int
	for _, event := range events {
		switch event.Type {
		case "content_block_start":
			if event.ContentBlock == nil {
				continue
			}
			block := *event.ContentBlock
			active[event.Index] = &streamBlock{block: block}
			order = append(order, event.Index)
		case "content_block_delta":
			current := active[event.Index]
			if current == nil {
				continue
			}
			if event.Delta.Text != "" {
				current.text.WriteString(event.Delta.Text)
			}
			if event.Delta.PartialJSON != "" {
				current.input.WriteString(event.Delta.PartialJSON)
			}
		}
	}

	blocks := make([]anthropic.ContentBlock, 0, len(order))
	for _, index := range order {
		current := active[index]
		if current == nil {
			continue
		}
		block := current.block
		if current.text.Len() > 0 {
			block.Text = current.text.String()
		}
		if current.input.Len() > 0 {
			block.Input = json.RawMessage(current.input.String())
		}
		blocks = append(blocks, block)
	}
	return blocks
}

func injectUsageIntoStart(events []anthropic.StreamEvent, usage anthropic.Usage) []anthropic.StreamEvent {
	for i, event := range events {
		if event.Type == "message_start" && event.Message != nil {
			event.Message.Usage = usage
			events[i] = event
			break
		}
	}
	return events
}

type staticStream struct {
	events []anthropic.StreamEvent
	pos    int
}

func (s *staticStream) Next() (anthropic.StreamEvent, error) {
	if s.pos >= len(s.events) {
		return anthropic.StreamEvent{}, io.EOF
	}
	event := s.events[s.pos]
	s.pos++
	return event, nil
}

func (s *staticStream) Close() error {
	return nil
}
