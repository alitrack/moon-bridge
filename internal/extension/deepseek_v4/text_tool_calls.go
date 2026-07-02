package deepseekv4

import (
	"encoding/json"
	"encoding/xml"
	"strings"

	"moonbridge/internal/format"
)

// toolCallsXML is the XML structure of DeepSeek V4's text-encoded tool calls.
// DeepSeek V4 in reasoning mode sometimes emits tool calls as XML text inside
// reasoning/content blocks rather than as structured tool_use blocks.
//
// Example:
//
//	<tool_calls>
//	<invoke name="web_search">
//	<parameter name="query" string="true">search term</parameter>
//	</invoke>
//	</tool_calls>
type toolCallsXML struct {
	XMLName xml.Name       `xml:"tool_calls"`
	Invokes []toolCallXML  `xml:"invoke"`
}

type toolCallXML struct {
	Name       string          `xml:"name,attr"`
	Parameters []parameterXML  `xml:"parameter"`
}

type parameterXML struct {
	Name     string `xml:"name,attr"`
	String   string `xml:"string,attr"`
	CharData string `xml:",chardata"`
}

// parseTextToolCalls scans a text block for <tool_calls> XML and, if found,
// converts it to structured tool_use blocks. Returns the converted blocks
// (replacing the original text block) and true if conversion happened.
//
// Surrounding text before/after the <tool_calls> block is preserved as
// separate text blocks.
func parseTextToolCalls(block format.CoreContentBlock) ([]format.CoreContentBlock, bool) {
	if block.Type != "text" || block.Text == "" {
		return nil, false
	}

	text := block.Text

	// Fast path: no tool_calls tag present.
	if !strings.Contains(text, "<tool_calls>") {
		return nil, false
	}

	startTag := "<tool_calls>"
	endTag := "</tool_calls>"

	startIdx := strings.Index(text, startTag)
	endIdx := strings.LastIndex(text, endTag)
	if startIdx < 0 || endIdx < 0 || endIdx <= startIdx {
		return nil, false
	}

	xmlContent := text[startIdx : endIdx+len(endTag)]
	prefix := strings.TrimSpace(text[:startIdx])
	suffix := strings.TrimSpace(text[endIdx+len(endTag):])

	var tc toolCallsXML
	if err := xml.Unmarshal([]byte(xmlContent), &tc); err != nil {
		return nil, false
	}

	if len(tc.Invokes) == 0 {
		return nil, false
	}

	var result []format.CoreContentBlock

	// Preserve leading text before the <tool_calls> block.
	if prefix != "" {
		result = append(result, format.CoreContentBlock{
			Type: "text",
			Text: prefix,
		})
	}

	// Convert each tool call to a structured tool_use block.
	for _, invoke := range tc.Invokes {
		name := invoke.Name
		id := "call_" + name // synthetic ID

		// Build input JSON from parameters.
		input := make(map[string]any)
		for _, param := range invoke.Parameters {
			val := param.CharData
			if val == "" {
				val = param.String
			}
			if val != "" {
				// Try to parse as JSON first (for numeric/boolean/object values).
				// If that fails, treat as string.
				var jsonVal any
				if err := json.Unmarshal([]byte(val), &jsonVal); err == nil {
					input[param.Name] = jsonVal
				} else {
					input[param.Name] = val
				}
			}
		}

		inputJSON, err := json.Marshal(input)
		if err != nil {
			inputJSON = []byte("{}")
		}

		result = append(result, format.CoreContentBlock{
			Type:      "tool_use",
			ToolUseID: id,
			ToolName:  name,
			ToolInput: inputJSON,
		})
	}

	// Preserve trailing text after the </tool_calls> block.
	if suffix != "" {
		result = append(result, format.CoreContentBlock{
			Type: "text",
			Text: suffix,
		})
	}

	return result, true
}

// ParseTextToolCallsInResponse scans all messages in a CoreResponse for
// text blocks containing <tool_calls> XML and converts them to structured
// tool_use blocks. Returns true if any conversions were made.
//
// Call this after receiving the upstream response and before converting
// it to the client's protocol format.
func ParseTextToolCallsInResponse(resp *format.CoreResponse) bool {
	if resp == nil {
		return false
	}

	converted := false
	for i, msg := range resp.Messages {
		if msg.Role != "assistant" || len(msg.Content) == 0 {
			continue
		}

		var newContent []format.CoreContentBlock
		changed := false
		for _, block := range msg.Content {
			if parsed, ok := parseTextToolCalls(block); ok {
				newContent = append(newContent, parsed...)
				changed = true
			} else {
				newContent = append(newContent, block)
			}
		}

		if changed {
			resp.Messages[i].Content = newContent
			converted = true
		}
	}

	return converted
}
