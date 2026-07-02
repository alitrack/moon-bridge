package deepseekv4

import (
	"encoding/json"
	"testing"

	"moonbridge/internal/format"
)

func TestParseTextToolCalls_SingleToolCall(t *testing.T) {
	text := `<tool_calls>
<invoke name="web_search">
<parameter name="query" string="true">test query</parameter>
</invoke>
</tool_calls>`

	block := format.CoreContentBlock{
		Type: "text",
		Text: text,
	}

	result, ok := parseTextToolCalls(block)
	if !ok {
		t.Fatal("expected conversion to succeed")
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 block, got %d: %+v", len(result), result)
	}

	if result[0].Type != "tool_use" {
		t.Fatalf("expected tool_use block, got %s", result[0].Type)
	}

	if result[0].ToolName != "web_search" {
		t.Fatalf("expected tool name 'web_search', got %s", result[0].ToolName)
	}

	var input map[string]any
	if err := json.Unmarshal(result[0].ToolInput, &input); err != nil {
		t.Fatalf("failed to parse tool input: %v", err)
	}

	if input["query"] != "test query" {
		t.Fatalf("expected query='test query', got %v", input["query"])
	}
}

func TestParseTextToolCalls_MultipleToolCalls(t *testing.T) {
	text := `<tool_calls>
<invoke name="web_search">
<parameter name="query" string="true">search term</parameter>
</invoke>
<invoke name="firecrawl_fetch">
<parameter name="url" string="true">https://example.com</parameter>
</invoke>
</tool_calls>`

	block := format.CoreContentBlock{
		Type: "text",
		Text: text,
	}

	result, ok := parseTextToolCalls(block)
	if !ok {
		t.Fatal("expected conversion to succeed")
	}

	if len(result) != 2 {
		t.Fatalf("expected 2 blocks, got %d", len(result))
	}

	// First tool call
	if result[0].ToolName != "web_search" {
		t.Fatalf("expected first tool 'web_search', got %s", result[0].ToolName)
	}

	// Second tool call
	if result[1].ToolName != "firecrawl_fetch" {
		t.Fatalf("expected second tool 'firecrawl_fetch', got %s", result[1].ToolName)
	}
}

func TestParseTextToolCalls_PreservesSurroundingText(t *testing.T) {
	text := `Here are the results:

<tool_calls>
<invoke name="web_search">
<parameter name="query" string="true">test</parameter>
</invoke>
</tool_calls>

Let me know if you need more.`

	block := format.CoreContentBlock{
		Type: "text",
		Text: text,
	}

	result, ok := parseTextToolCalls(block)
	if !ok {
		t.Fatal("expected conversion to succeed")
	}

	if len(result) != 3 {
		t.Fatalf("expected 3 blocks (prefix + tool_use + suffix), got %d", len(result))
	}

	// First block should be the prefix text
	if result[0].Type != "text" {
		t.Fatalf("expected first block to be text, got %s", result[0].Type)
	}
	if !contains(result[0].Text, "Here are the results") {
		t.Fatalf("expected prefix text, got: %q", result[0].Text)
	}

	// Second block should be tool_use
	if result[1].Type != "tool_use" {
		t.Fatalf("expected second block to be tool_use, got %s", result[1].Type)
	}

	// Third block should be suffix text
	if result[2].Type != "text" {
		t.Fatalf("expected third block to be text, got %s", result[2].Type)
	}
	if !contains(result[2].Text, "Let me know") {
		t.Fatalf("expected suffix text, got: %q", result[2].Text)
	}
}

func TestParseTextToolCalls_NoToolCalls(t *testing.T) {
	text := "This is just a normal response with no tool calls."

	block := format.CoreContentBlock{
		Type: "text",
		Text: text,
	}

	_, ok := parseTextToolCalls(block)
	if ok {
		t.Fatal("expected no conversion for normal text")
	}
}

func TestParseTextToolCalls_NonTextBlock(t *testing.T) {
	block := format.CoreContentBlock{
		Type: "tool_use",
	}

	_, ok := parseTextToolCalls(block)
	if ok {
		t.Fatal("expected no conversion for non-text blocks")
	}
}

func TestParseTextToolCallsInResponse(t *testing.T) {
	resp := &format.CoreResponse{
		Messages: []format.CoreMessage{
			{
				Role: "assistant",
				Content: []format.CoreContentBlock{
					{
						Type: "text",
						Text: `<tool_calls>
<invoke name="web_search">
<parameter name="query" string="true">hello</parameter>
</invoke>
</tool_calls>`,
					},
				},
			},
		},
	}

	if !ParseTextToolCallsInResponse(resp) {
		t.Fatal("expected conversion to happen")
	}

	msg := resp.Messages[0]
	if len(msg.Content) != 1 {
		t.Fatalf("expected 1 content block, got %d", len(msg.Content))
	}
	if msg.Content[0].Type != "tool_use" {
		t.Fatalf("expected tool_use, got %s", msg.Content[0].Type)
	}
	if msg.Content[0].ToolName != "web_search" {
		t.Fatalf("expected 'web_search', got %s", msg.Content[0].ToolName)
	}
}

func TestParseTextToolCallsInResponse_NilResponse(t *testing.T) {
	if ParseTextToolCallsInResponse(nil) {
		t.Fatal("expected false for nil response")
	}
}

func TestParseTextToolCallsInResponse_NoToolCalls(t *testing.T) {
	resp := &format.CoreResponse{
		Messages: []format.CoreMessage{
			{
				Role: "assistant",
				Content: []format.CoreContentBlock{
					{
						Type: "text",
						Text: "Just a normal response.",
					},
				},
			},
		},
	}

	if ParseTextToolCallsInResponse(resp) {
		t.Fatal("expected no conversion for normal response")
	}
}

func TestParseTextToolCallsInResponse_SkipsUserMessages(t *testing.T) {
	resp := &format.CoreResponse{
		Messages: []format.CoreMessage{
			{
				Role: "user",
				Content: []format.CoreContentBlock{
					{
						Type: "text",
						Text: `<tool_calls><invoke name="web_search"><parameter name="query" string="true">test</parameter></invoke></tool_calls>`,
					},
				},
			},
		},
	}

	if ParseTextToolCallsInResponse(resp) {
		t.Fatal("expected no conversion for user messages")
	}
}

func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && (s == substr || len(s) >= len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || findSubstr(s, substr)))
}

func findSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
