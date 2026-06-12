package server

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"moonbridge/internal/config"
	"moonbridge/internal/format"
	"moonbridge/internal/protocol/anthropic"
	"moonbridge/internal/protocol/chat"
	"moonbridge/internal/service/provider"
	visualpkg "moonbridge/internal/extension/visual"
)

// handleAnthropicMessages handles POST /v1/messages (Anthropic Messages API).
// Used by Claude Code, Claude API clients, etc.
func (s *Server) handleAnthropicMessages(w http.ResponseWriter, r *http.Request) {
	log := slog.Default().With("path", r.URL.Path, "method", r.Method, "remote", r.RemoteAddr)
	requestStart := time.Now()

	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Error("读取请求体失败", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	var msgReq anthropic.MessageRequest
	if err := json.Unmarshal(body, &msgReq); err != nil {
		preview := string(body)
		if len(preview) > 500 {
			preview = preview[:500] + "..."
		}
		log.Warn("无效的 Anthropic 请求", "error", err, "body_preview", preview)
		os.WriteFile("/tmp/mb_anthropic_err.json", body, 0644)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if msgReq.Model == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model is required"})
		return
	}

	route, resolveErr := s.resolveModelOrFallback(msgReq.Model)
	if resolveErr != nil {
		log.Warn("未知模型", "model", msgReq.Model)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("unknown model: %q", msgReq.Model)})
		return
	}

	msgReq = s.injectVisualDescriptions(r.Context(), msgReq)

	if msgReq.Stream {
		s.handleAnthropicMessagesStream(w, r, &msgReq, route)
		return
	}

	coreReq := anthropicMessageToCore(&msgReq)
	coreResp, dispErr := s.dispatchCoreRequest(r.Context(), coreReq, route)
	if dispErr != nil {
		log.Error("Anthropic dispatch 失败", "error", dispErr)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": dispErr.Error()})
		return
	}
	outMsg := coreToAnthropicResponse(coreResp)
	outMsg.Model = coreResp.Model
	writeJSON(w, http.StatusOK, outMsg)

	if pref, ok := route.Preferred(); ok {
		usage := usageFromAnthropic(string(pref.Protocol), "core_dispatch", coreResp.Usage, false)
		s.onRequestCompleted(
			msgReq.Model, coreResp.Model, pref.ProviderKey,
			requestStart, usage,
			0, "success", "",
		)
	}
}

// handleChatCompletions handles POST /v1/chat/completions (OpenAI Chat API).
func (s *Server) handleChatCompletions(w http.ResponseWriter, r *http.Request) {
	log := slog.Default().With("path", r.URL.Path, "method", r.Method, "remote", r.RemoteAddr)
	requestStart := time.Now()

	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Error("读取请求体失败", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	var chatReq chat.ChatRequest
	if err := json.Unmarshal(body, &chatReq); err != nil {
		log.Warn("无效的 Chat 请求", "error", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if chatReq.Model == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "model is required"})
		return
	}

	route, resolveErr := s.resolveModelOrFallback(chatReq.Model)
	if resolveErr != nil {
		log.Warn("未知模型", "model", chatReq.Model)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("unknown model: %q", chatReq.Model)})
		return
	}

	if chatReq.Stream {
		s.handleChatCompletionsStream(w, r, &chatReq, route)
		return
	}

	coreReq := chatRequestToCore(&chatReq)
	coreResp, dispErr := s.dispatchCoreRequest(r.Context(), coreReq, route)
	if dispErr != nil {
		log.Error("Chat dispatch 失败", "error", dispErr)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": dispErr.Error()})
		return
	}
	outChat := coreToChatResponse(coreResp)
	outChat.Model = coreResp.Model
	writeJSON(w, http.StatusOK, outChat)

	if pref, ok := route.Preferred(); ok {
		usage := usageFromAnthropic(string(pref.Protocol), "core_dispatch", coreResp.Usage, false)
		s.onRequestCompleted(
			chatReq.Model, coreResp.Model, pref.ProviderKey,
			requestStart, usage,
			0, "success", "",
		)
	}
}

// dispatchCoreRequest runs the adapter pipeline and returns a CoreResponse.
// The caller is responsible for converting to the entry protocol format.
func (s *Server) dispatchCoreRequest(
	ctx context.Context,
	coreReq *format.CoreRequest,
	route *provider.ResolvedRoute,
) (*format.CoreResponse, error) {
	log := slog.Default().With("model", coreReq.Model, "path", "core_dispatch")

	pm := s.activeProviderManager()
	if pm == nil {
		return nil, fmt.Errorf("provider manager not available")
	}

	preferred, ok := route.Preferred()
	if !ok {
		log.Error("路由无可用提供商")
		return nil, fmt.Errorf("no available provider")
	}

	providerAdapter, ok := s.adapterRegistry.GetProvider(preferred.Protocol)
	if !ok {
		log.Error("无可用协议适配器", "protocol", preferred.Protocol)
		return nil, fmt.Errorf("no adapter for protocol %q", preferred.Protocol)
	}

	coreReq.Model = preferred.UpstreamModel

	upstreamAny, err := providerAdapter.FromCoreRequest(ctx, coreReq)
	if err != nil {
		log.Error("Core → upstream 转换失败", "error", err)
		return nil, fmt.Errorf("conversion error: %w", err)
	}

	start := time.Now()

	switch preferred.Protocol {
	case config.ProtocolAnthropic:
		return s.dispatchAnthropicCore(ctx, upstreamAny, preferred, providerAdapter, log, start)
	case config.ProtocolOpenAIChat:
		return s.dispatchChatCore(ctx, upstreamAny, preferred, providerAdapter, log, start)
	default:
		log.Error("不支持的协议", "protocol", preferred.Protocol)
		return nil, fmt.Errorf("unsupported protocol: %s", preferred.Protocol)
	}
}

func (s *Server) dispatchAnthropicCore(
	ctx context.Context,
	upstreamAny interface{}, preferred provider.ProviderCandidate,
	providerAdapter format.ProviderAdapter, log *slog.Logger, start time.Time,
) (*format.CoreResponse, error) {
	upstreamReq, ok := upstreamAny.(*anthropic.MessageRequest)
	if !ok {
		return nil, fmt.Errorf("unexpected upstream type")
	}

	client := preferred.Client
	if client == nil {
		return nil, fmt.Errorf("no upstream client")
	}

	rawResp, err := client.CreateMessage(context.Background(), *upstreamReq)
	if err != nil {
		log.Error("上游调用失败", "error", err)
		return nil, fmt.Errorf("upstream error: %w", err)
	}

	msgResp, ok := rawResp.(anthropic.MessageResponse)
	if !ok {
		log.Error("非预期的上游响应类型", "type", fmt.Sprintf("%T", rawResp))
		return nil, fmt.Errorf("unexpected upstream response type %T", rawResp)
	}

	coreResp, err := providerAdapter.ToCoreResponse(context.Background(), &msgResp)
	if err != nil {
		log.Error("上游响应转换失败", "error", err)
		return nil, fmt.Errorf("response conversion error: %w", err)
	}

	log.Info("Anthropic Messages 完成",
		"model", preferred.UpstreamModel,
		"input", coreResp.Usage.InputTokens,
		"output", coreResp.Usage.OutputTokens,
		"duration", time.Since(start),
	)
	return coreResp, nil
}

func (s *Server) dispatchChatCore(
	ctx context.Context,
	upstreamAny interface{}, preferred provider.ProviderCandidate,
	providerAdapter format.ProviderAdapter, log *slog.Logger, start time.Time,
) (*format.CoreResponse, error) {
	chatReq, ok := upstreamAny.(*chat.ChatRequest)
	if !ok {
		return nil, fmt.Errorf("unexpected chat upstream type")
	}

	chatClientRaw := s.activeChatClient(preferred.ProviderKey)
	if chatClientRaw == nil {
		return nil, fmt.Errorf("no chat client")
	}
	chatClient, ok := chatClientRaw.(*chat.Client)
	if !ok {
		return nil, fmt.Errorf("invalid chat client type")
	}

	rawResp, err := chatClient.CreateChat(context.Background(), chatReq)
	if err != nil {
		log.Error("Chat 上游调用失败", "error", err)
		return nil, fmt.Errorf("upstream error: %w", err)
	}

	coreResp, err := providerAdapter.ToCoreResponse(context.Background(), rawResp)
	if err != nil {
		log.Error("Chat 响应转换失败", "error", err)
		return nil, fmt.Errorf("response conversion error: %w", err)
	}

	log.Info("Chat Completions 完成",
		"model", preferred.UpstreamModel,
		"input", coreResp.Usage.InputTokens,
		"output", coreResp.Usage.OutputTokens,
		"duration", time.Since(start),
	)
	return coreResp, nil
}

// ============================================================================
// Incoming protocol converters
// ============================================================================

func anthropicMessageToCore(req *anthropic.MessageRequest) *format.CoreRequest {
	if req == nil {
		return nil
	}
	coreReq := &format.CoreRequest{
		Model:         req.Model,
		MaxTokens:     req.MaxTokens,
		Messages:      make([]format.CoreMessage, 0, len(req.Messages)),
		System:        anthropicBlocksToCore(req.System),
		Temperature:   req.Temperature,
		TopP:          req.TopP,
		TopK:          req.TopK,
		StopSequences: req.StopSequences,
		Stream:        req.Stream,
		Metadata:      req.Metadata,
	}
	for _, msg := range req.Messages {
		coreReq.Messages = append(coreReq.Messages, format.CoreMessage{
			Role:    msg.Role,
			Content: anthropicBlocksToCore(msg.Content),
		})
	}
	if len(req.Tools) > 0 {
		coreReq.Tools = make([]format.CoreTool, 0, len(req.Tools))
		for _, t := range req.Tools {
			coreReq.Tools = append(coreReq.Tools, format.CoreTool{
				Name:        t.Name,
				Description: t.Description,
				InputSchema: t.InputSchema,
			})
		}
	}
	if req.ToolChoice != nil {
		coreReq.ToolChoice = &format.CoreToolChoice{
			Mode: req.ToolChoice.Type,
			Name: req.ToolChoice.Name,
		}
	}
	if req.Thinking != nil {
		budget := req.Thinking.BudgetTokens
		thinkType := req.Thinking.Type
		// Claude Code sends "adaptive"+budget_tokens=0, which DeepSeek
		// interprets as unlimited thinking. Disable it entirely for now.
		if budget == 0 && thinkType == "adaptive" {
			thinkType = "disabled"
		}
		coreReq.Thinking = &format.CoreThinkingConfig{
			Type:         thinkType,
			BudgetTokens: budget,
		}
	}
	return coreReq
}

func chatRequestToCore(req *chat.ChatRequest) *format.CoreRequest {
	if req == nil {
		return nil
	}
	coreReq := &format.CoreRequest{
		Model:         req.Model,
		MaxTokens:     req.MaxTokens,
		Messages:      make([]format.CoreMessage, 0, len(req.Messages)),
		Temperature:   req.Temperature,
		TopP:          req.TopP,
		StopSequences: req.Stop,
		Stream:        req.Stream,
	}
	for _, msg := range req.Messages {
		if msg.Role == "system" {
			coreReq.System = append(coreReq.System, format.CoreContentBlock{
				Type: "text",
				Text: chatContentToString(msg.Content),
			})
			continue
		}
		coreMsg := format.CoreMessage{Role: msg.Role}
		if coreMsg.Role == "tool" {
			coreMsg.Role = "user"
		}
		// Tool call result (tool message).
		if msg.ToolCallID != "" {
			coreMsg.Content = []format.CoreContentBlock{{
				Type:              "tool_result",
				ToolUseID:         msg.ToolCallID,
				ToolResultContent: []format.CoreContentBlock{{Type: "text", Text: chatContentToString(msg.Content)}},
			}}
			coreReq.Messages = append(coreReq.Messages, coreMsg)
			continue
		}
		// Assistant message with tool calls.
		if len(msg.ToolCalls) > 0 {
			for _, tc := range msg.ToolCalls {
				coreMsg.Content = append(coreMsg.Content, format.CoreContentBlock{
					Type:      "tool_use",
					ToolUseID: tc.ID,
					ToolName:  tc.Function.Name,
					ToolInput: json.RawMessage(tc.Function.Arguments),
				})
			}
		}
		// Text content (string or []ContentPart).
		if text := chatContentToString(msg.Content); text != "" && len(coreMsg.Content) == 0 {
			coreMsg.Content = []format.CoreContentBlock{{Type: "text", Text: text}}
		}
		// Multi-part content (images).
		if parts, ok := msg.Content.([]interface{}); ok {
			for _, p := range parts {
				pm, ok := p.(map[string]interface{})
				if !ok {
					continue
				}
				ptype, _ := pm["type"].(string)
				switch ptype {
				case "text":
					if t, ok := pm["text"].(string); ok && len(coreMsg.Content) == 0 {
						coreMsg.Content = append(coreMsg.Content, format.CoreContentBlock{Type: "text", Text: t})
					}
				case "image_url":
					if iu, ok := pm["image_url"].(map[string]interface{}); ok {
						if url, ok := iu["url"].(string); ok {
							coreMsg.Content = append(coreMsg.Content, format.CoreContentBlock{
								Type:      "image",
								ImageData: url,
							})
						}
					}
				}
			}
		}
		if len(coreMsg.Content) == 0 {
			coreMsg.Content = []format.CoreContentBlock{{Type: "text", Text: chatContentToString(msg.Content)}}
		}
		coreReq.Messages = append(coreReq.Messages, coreMsg)
	}

	// Tools
	if len(req.Tools) > 0 {
		coreReq.Tools = make([]format.CoreTool, 0, len(req.Tools))
		for _, t := range req.Tools {
			switch t.Type {
			case "function":
				coreReq.Tools = append(coreReq.Tools, format.CoreTool{
					Name:        t.Function.Name,
					Description: t.Function.Description,
					InputSchema: t.Function.Parameters,
				})
			default:
				coreReq.Tools = append(coreReq.Tools, format.CoreTool{Name: t.Type})
			}
		}
	}

	// ToolChoice
	if len(req.ToolChoice) > 0 {
		tc := format.CoreToolChoice{}
		raw := string(req.ToolChoice)
		if raw == `"none"` || raw == `"auto"` || raw == `"required"` {
			tc.Mode = strings.Trim(raw, `"`)
		} else {
			var obj map[string]json.RawMessage
			if json.Unmarshal(req.ToolChoice, &obj) == nil {
				if fn, ok := obj["function"]; ok {
					var fobj map[string]string
					if json.Unmarshal(fn, &fobj) == nil {
						tc.Mode = "any"
						tc.Name = fobj["name"]
					}
				}
			}
		}
		if tc.Mode != "" {
			coreReq.ToolChoice = &tc
		}
	}

	return coreReq
}

// ============================================================================
// Outgoing protocol converters
// ============================================================================

// coreToAnthropicResponse converts a CoreResponse to Anthropic Messages API format.
func coreToAnthropicResponse(coreResp *format.CoreResponse) anthropic.MessageResponse {
	out := anthropic.MessageResponse{
		ID:         coreResp.ID,
		Model:      coreResp.Model,
		StopReason: coreStatusToAnthropicStop(coreResp.Status),
		Usage: anthropic.Usage{
			InputTokens:  coreResp.Usage.InputTokens,
			OutputTokens: coreResp.Usage.OutputTokens,
		},
	}
	for _, msg := range coreResp.Messages {
		if msg.Role != "assistant" {
			continue
		}
		for _, block := range msg.Content {
			switch block.Type {
			case "text":
				out.Content = append(out.Content, anthropic.ContentBlock{Type: "text", Text: block.Text})
			case "reasoning":
				out.Content = append(out.Content, anthropic.ContentBlock{
					Type:      "thinking",
					Thinking:  block.ReasoningText,
					Signature: block.ReasoningSignature,
				})
			case "tool_use":
				out.Content = append(out.Content, anthropic.ContentBlock{
					Type:  "tool_use",
					ID:    block.ToolUseID,
					Name:  block.ToolName,
					Input: block.ToolInput,
				})
			}
		}
	}
	return out
}

func coreToChatResponse(coreResp *format.CoreResponse) chat.ChatResponse {
	out := chat.ChatResponse{
		ID:      coreResp.ID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   coreResp.Model,
		Usage: &chat.Usage{
			PromptTokens:     coreResp.Usage.InputTokens,
			CompletionTokens: coreResp.Usage.OutputTokens,
			TotalTokens:      coreResp.Usage.TotalTokens,
		},
	}
	for _, msg := range coreResp.Messages {
		if msg.Role != "assistant" {
			continue
		}
		choice := chat.Choice{
			Index:        len(out.Choices),
			FinishReason: "stop",
		}
		choice.Message.Role = "assistant"

		for _, block := range msg.Content {
			switch block.Type {
			case "text":
				choice.Message.Content = strings.TrimSpace(chatContentToString(choice.Message.Content) + block.Text)
			case "tool_use":
				choice.Message.ToolCalls = append(choice.Message.ToolCalls, chat.ToolCall{
					ID:   block.ToolUseID,
					Type: "function",
					Function: chat.ToolCallFunc{
						Name:      block.ToolName,
						Arguments: block.ToolInput,
					},
				})
				choice.FinishReason = "tool_calls"
			}
		}

		if choice.Message.Content == "" && len(choice.Message.ToolCalls) == 0 {
			continue
		}
		out.Choices = append(out.Choices, choice)
	}
	return out
}

// ============================================================================
// Shared helpers
// ============================================================================

func anthropicBlocksToCore(blocks []anthropic.ContentBlock) []format.CoreContentBlock {
	out := make([]format.CoreContentBlock, 0, len(blocks))
	for _, b := range blocks {
		switch b.Type {
		case "text":
			out = append(out, format.CoreContentBlock{Type: "text", Text: b.Text})
		case "image":
			src := ""
			mediaType := "image/png"
			if b.Source != nil {
				src = b.Source.Data
				if b.Source.MediaType != "" {
					mediaType = b.Source.MediaType
				}
			}
			out = append(out, format.CoreContentBlock{Type: "image", ImageData: src, MediaType: mediaType})
		case "tool_use":
			out = append(out, format.CoreContentBlock{
				Type:      "tool_use",
				ToolUseID: b.ID,
				ToolName:  b.Name,
				ToolInput: b.Input,
			})
		case "tool_result":
			out = append(out, format.CoreContentBlock{
				Type:              "tool_result",
				ToolUseID:         b.ToolUseID,
				ToolResultContent: anthropicBlocksToCore(toolResultToBlocks(b.Content)),
			})
		}
	}
	return out
}

func toolResultToBlocks(content any) []anthropic.ContentBlock {
	if content == nil {
		return nil
	}
	switch v := content.(type) {
	case string:
		return []anthropic.ContentBlock{{Type: "text", Text: v}}
	case []anthropic.ContentBlock:
		return v
	case []any:
		var blocks []anthropic.ContentBlock
		for _, item := range v {
			m, ok := item.(map[string]any)
			if !ok {
				continue
			}
			block := anthropic.ContentBlock{}
			if t, _ := m["type"].(string); t != "" {
				block.Type = t
			}
			switch block.Type {
			case "text":
				if text, _ := m["text"].(string); text != "" {
					block.Text = text
				}
			case "image":
				if src, ok := m["source"].(map[string]any); ok {
					is := anthropic.ImageSource{}
					if st, _ := src["type"].(string); st != "" {
						is.Type = st
					}
					if mt, _ := src["media_type"].(string); mt != "" {
						is.MediaType = mt
					}
					if d, _ := src["data"].(string); d != "" {
						is.Data = d
					}
					if u, _ := src["url"].(string); u != "" {
						is.URL = u
					}
					block.Source = &is
				}
			case "tool_use":
				if id, _ := m["id"].(string); id != "" {
					block.ID = id
				}
				if name, _ := m["name"].(string); name != "" {
					block.Name = name
				}
				if input, ok := m["input"]; ok {
					if raw, err := json.Marshal(input); err == nil {
						block.Input = raw
					}
				}
			case "tool_result":
				if tid, _ := m["tool_use_id"].(string); tid != "" {
					block.ToolUseID = tid
				}
				if inner, ok := m["content"]; ok {
					block.Content = inner
				}
			}
			blocks = append(blocks, block)
		}
		return blocks
	}
	return nil
}

func chatContentToString(content any) string {
	if content == nil {
		return ""
	}
	switch v := content.(type) {
	case string:
		return v
	case []interface{}:
		var texts []string
		for _, p := range v {
			if pm, ok := p.(map[string]interface{}); ok {
				if t, _ := pm["type"].(string); t == "text" {
					if text, _ := pm["text"].(string); text != "" {
						texts = append(texts, text)
					}
				}
			}
		}
		return strings.Join(texts, "")
	}
	return ""
}



func coreStatusToAnthropicStop(status string) string {
	switch status {
	case "completed":
		return "end_turn"
	case "tool_use":
		return "tool_use"
	default:
		return "end_turn"
	}
}

func writeErrorJSON(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// handleAnthropicMessagesStream handles streaming Anthropic Messages requests.
// Forwards upstream Anthropic SSE events as-is to the client.
func (s *Server) handleAnthropicMessagesStream(
	w http.ResponseWriter,
	r *http.Request,
	msgReq *anthropic.MessageRequest,
	route *provider.ResolvedRoute,
) {
	ctx := r.Context()
	log := slog.Default().With("model", msgReq.Model, "path", "messages_stream")
	t0 := time.Now()

	preferred, ok := route.Preferred()
	if !ok {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "no available provider"})
		return
	}

	client := preferred.Client
	if client == nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "no upstream client"})
		return
	}

	t1 := time.Now()
	coreReq := anthropicMessageToCore(msgReq)
	coreReq.Model = preferred.UpstreamModel

	providerAdapter, ok := s.adapterRegistry.GetProvider(preferred.Protocol)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "no adapter"})
		return
	}
	upstreamAny, err := providerAdapter.FromCoreRequest(ctx, coreReq)
	if err != nil {
		log.Error("转换失败", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	t2 := time.Now()

	start := time.Now()
	ch, err := client.StreamMessage(ctx, upstreamAny)
	if err != nil {
		log.Error("上游流式调用失败", "error", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher, _ := w.(http.Flusher)

	for evtAny := range ch {
		evt, ok := evtAny.(anthropic.StreamEvent)
		if !ok {
			continue
		}
		data, err := json.Marshal(evt)
		if err != nil {
			continue
		}
		if evt.Type != "" {
			fmt.Fprintf(w, "event: %s\n", evt.Type)
		}
		fmt.Fprintf(w, "data: %s\n\n", data)
		if flusher != nil {
			flusher.Flush()
		}
	}

	log.Info("Anthropic Messages 流式完成",
		"model", preferred.UpstreamModel,
		"setup_ms", t2.Sub(t0).Milliseconds(),
		"convert_ms", t2.Sub(t1).Milliseconds(),
		"stream_ms", time.Since(start).Milliseconds(),
		"total_ms", time.Since(t0).Milliseconds(),
	)
}

// handleChatCompletionsStream handles streaming Chat Completions requests.
func (s *Server) handleChatCompletionsStream(
	w http.ResponseWriter,
	r *http.Request,
	chatReq *chat.ChatRequest,
	route *provider.ResolvedRoute,
) {
	ctx := r.Context()
	log := slog.Default().With("model", chatReq.Model, "path", "chat_stream")

	preferred, ok := route.Preferred()
	if !ok {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "no available provider"})
		return
	}

	chatClientRaw := s.activeChatClient(preferred.ProviderKey)
	if chatClientRaw == nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "no chat client"})
		return
	}
	chatClient, ok := chatClientRaw.(*chat.Client)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "invalid chat client"})
		return
	}

	chatReq.Model = preferred.UpstreamModel

	start := time.Now()
	ch, err := chatClient.StreamChat(ctx, chatReq)
	if err != nil {
		log.Error("Chat 流式调用失败", "error", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher, _ := w.(http.Flusher)

	for chunk := range ch {
		data, err := json.Marshal(chunk)
		if err != nil {
			continue
		}
		fmt.Fprintf(w, "data: %s\n\n", data)
		if flusher != nil {
			flusher.Flush()
		}
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	if flusher != nil {
		flusher.Flush()
	}

	log.Info("Chat Completions 流式完成", "model", preferred.UpstreamModel, "duration", time.Since(start))
}

// injectVisualDescriptions checks if visual extension is enabled for the model,
// extracts images from the request, calls the vision model for descriptions,
// and injects text descriptions in place of image blocks.
func (s *Server) injectVisualDescriptions(ctx context.Context, req anthropic.MessageRequest) anthropic.MessageRequest {
	// Only process images in the LATEST user message — avoid re-describing
	// conversation history images on every turn (4×10s Qwen VL calls).
	lastUserIdx := -1
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			lastUserIdx = i
			break
		}
	}
	if lastUserIdx < 0 {
		return req
	}

	hasImages := false
	for _, block := range req.Messages[lastUserIdx].Content {
		if block.Type == "image" && block.Source != nil {
			hasImages = true
			break
		}
		// Claude Code sends images inside tool_result blocks (Read tool output).
		if block.Type == "tool_result" {
			for _, inner := range toolResultContentBlocks(block.Content) {
				if inner.Type == "image" && inner.Source != nil {
					hasImages = true
					break
				}
			}
		}
	}
	if !hasImages {
		return req
	}

	if s.runtime == nil {
		slog.Default().Warn("visual: runtime is nil, skipping")
		return req
	}
	cfgV := s.runtime.Current().Config
	visCfg, visOk := visualpkg.ConfigForModelFromResolvedConfig(cfgV, req.Model)
	slog.Default().Info("visual: config check", "model", req.Model, "visOk", visOk, "provider", visCfg.Provider, "visModel", visCfg.Model)
	if !visOk || visCfg.Provider == "" || visCfg.Model == "" {
		return req
	}

	chatClientRaw := s.activeChatClient(visCfg.Provider)
	if chatClientRaw == nil {
		return req
	}
	chatClient, ok := chatClientRaw.(*chat.Client)
	if !ok {
		return req
	}

	modified := false
	msg := &req.Messages[lastUserIdx]
	var newContent []anthropic.ContentBlock
	for _, block := range msg.Content {
		if block.Type == "tool_result" {
			// Claude Code sends images inside tool_result blocks (Read tool output).
			// Recurse into tool_result content to find and replace image blocks.
			innerBlocks := toolResultContentBlocks(block.Content)
			if len(innerBlocks) > 0 {
				newBlock := block
				var newInner []anthropic.ContentBlock
				for _, inner := range innerBlocks {
					if inner.Type != "image" || inner.Source == nil {
						newInner = append(newInner, inner)
						continue
					}
					desc, err := s.describeImage(ctx, chatClient, visCfg, inner.Source)
					if err != nil {
						slog.Default().Warn("visual description failed", "error", err)
						newInner = append(newInner, inner)
						continue
					}
					newInner = append(newInner, anthropic.ContentBlock{
						Type: "text",
						Text: "[Image description from vision model (" + inner.Source.MediaType + ")]\n" + desc,
					})
					modified = true
				}
				newBlock.Content = newInner
				newContent = append(newContent, newBlock)
				continue
			}
		}
		if block.Type != "image" || block.Source == nil {
			newContent = append(newContent, block)
			continue
		}
		desc, err := s.describeImage(ctx, chatClient, visCfg, block.Source)
		if err != nil {
			slog.Default().Warn("visual description failed", "error", err)
			newContent = append(newContent, block)
			continue
		}
		newContent = append(newContent, anthropic.ContentBlock{
			Type: "text",
			Text: "[Image description from vision model (" + block.Source.MediaType + ")]\n" + desc,
		})
		modified = true
	}
	msg.Content = newContent

	if modified {
		slog.Default().Info("visual descriptions injected", "model", req.Model)
	}
	return req
}

func (s *Server) describeImage(ctx context.Context, chatClient *chat.Client,
	visCfg visualpkg.Config, source *anthropic.ImageSource,
) (string, error) {
	// Hash raw base64 data for cross-request caching. Same image sent
	// across multiple Claude Code tool-call rounds gets the same key,
	// avoiding redundant Qwen VL calls (saves ~8s per duplicate).
	cacheKey := ""
	if source.Data != "" {
		h := sha256.Sum256([]byte(source.Data))
		cacheKey = fmt.Sprintf("%x", h[:16])
	}
	if cacheKey != "" {
		if cached, ok := s.visualCache.Load(cacheKey); ok {
			return cached.(string), nil
		}
	}

	var imgURL string
	switch source.Type {
	case "base64":
		imgURL = compressAndEncodeImage(source.Data, source.MediaType)
	case "url":
		imgURL = source.URL
	default:
		if source.Data != "" {
			imgURL = compressAndEncodeImage(source.Data, source.MediaType)
		} else if source.URL != "" {
			imgURL = source.URL
		} else {
			return "", fmt.Errorf("no image data")
		}
	}

	chatReq := &chat.ChatRequest{
		Model: visCfg.Model,
		Messages: []chat.ChatMessage{
			{
				Role: "user",
				Content: []chat.ContentPart{
					{Type: "text", Text: "Describe this image in detail. What do you see?"},
					{Type: "image_url", ImageURL: &chat.ImageURL{URL: imgURL}},
				},
			},
		},
		MaxTokens: visCfg.MaxTokens,
	}
	if chatReq.MaxTokens <= 0 {
		chatReq.MaxTokens = 1024
	}

	resp, err := chatClient.CreateChat(ctx, chatReq)
	if err != nil {
		return "", fmt.Errorf("vision API error: %w", err)
	}
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no response from vision model")
	}
	content, _ := resp.Choices[0].Message.Content.(string)
	if content == "" {
		return "", fmt.Errorf("empty response from vision model")
	}

	if cacheKey != "" {
		s.visualCache.Store(cacheKey, content)
	}
	return content, nil
}

// compressAndEncodeImage compresses large PNG images to JPEG before sending
// to the vision model, reducing payload size dramatically without meaningful
// quality loss for image description purposes.
//
// Images under 100KB raw bytes or non-PNG images are passed through unchanged.
func compressAndEncodeImage(b64Data string, mediaType string) string {
	// Only compress PNG — JPEG/GIF/WebP are already compact or unsupported by stdlib.
	if mediaType != "image/png" {
		return "data:" + mediaType + ";base64," + b64Data
	}
	raw, err := base64.StdEncoding.DecodeString(b64Data)
	if err != nil || len(raw) < 100*1024 {
		return "data:" + mediaType + ";base64," + b64Data
	}
	img, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return "data:" + mediaType + ";base64," + b64Data
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 80}); err != nil {
		return "data:" + mediaType + ";base64," + b64Data
	}
	if buf.Len() >= len(raw) {
		// JPEG wasn't smaller — keep original
		return "data:" + mediaType + ";base64," + b64Data
	}
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
}

// toolResultContentBlocks extracts []ContentBlock from a tool_result's
// Content field, which is typed as `any`. Uses JSON round-trip to ensure
// correct deserialization of nested source fields.
func toolResultContentBlocks(content any) []anthropic.ContentBlock {
	if content == nil {
		return nil
	}
	// Re-marshal and unmarshal to get proper Go types.
	b, err := json.Marshal(content)
	if err != nil {
		return nil
	}
	var blocks []anthropic.ContentBlock
	if err := json.Unmarshal(b, &blocks); err != nil {
		return nil
	}
	return blocks
}
