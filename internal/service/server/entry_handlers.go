package server

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"context"
	"net/http"
	"strings"
	"time"

	"moonbridge/internal/config"
	"moonbridge/internal/format"
	"moonbridge/internal/protocol/anthropic"
	"moonbridge/internal/protocol/chat"
	"moonbridge/internal/service/provider"
)

// handleAnthropicMessages handles POST /v1/messages (Anthropic Messages API).
// Used by Claude Code, Claude API clients, etc.
func (s *Server) handleAnthropicMessages(w http.ResponseWriter, r *http.Request) {
	log := slog.Default().With("path", r.URL.Path, "method", r.Method, "remote", r.RemoteAddr)

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
		log.Warn("无效的 Anthropic 请求", "error", err)
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
}

// handleChatCompletions handles POST /v1/chat/completions (OpenAI Chat API).
func (s *Server) handleChatCompletions(w http.ResponseWriter, r *http.Request) {
	log := slog.Default().With("path", r.URL.Path, "method", r.Method, "remote", r.RemoteAddr)

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
	case []any:
		var blocks []anthropic.ContentBlock
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				block := anthropic.ContentBlock{}
				if t, _ := m["type"].(string); t != "" {
					block.Type = t
				}
				if text, _ := m["text"].(string); text != "" {
					block.Text = text
				}
				blocks = append(blocks, block)
			}
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
