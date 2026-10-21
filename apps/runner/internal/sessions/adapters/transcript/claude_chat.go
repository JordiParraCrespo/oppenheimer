package transcript

import (
	"encoding/json"
	"unicode/utf8"
)

// The cuts compactClaude makes. A chat view shows what the agent said and
// did; the full text of a file it read or wrote stays on the host, where the
// terminal and the worktree already show it.
const (
	chatTextMax       = 24 << 10
	chatThinkingMax   = 8 << 10
	chatToolInputMax  = 6 << 10
	chatToolResultMax = 4 << 10
)

// claudeChatLine is the part of a Claude Code transcript line the chat view
// reads.
type claudeChatLine struct {
	Type             string `json:"type"`
	UUID             string `json:"uuid"`
	Timestamp        string `json:"timestamp"`
	IsMeta           bool   `json:"isMeta"`
	IsSidechain      bool   `json:"isSidechain"`
	IsCompactSummary bool   `json:"isCompactSummary"`
	Message          *struct {
		ID      string          `json:"id"`
		Role    string          `json:"role"`
		Model   string          `json:"model"`
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

// claudeBlock is one content block, read loosely: each type uses a few of
// these fields.
type claudeBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text"`
	Thinking  string          `json:"thinking"`
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Input     json.RawMessage `json:"input"`
	ToolUseID string          `json:"tool_use_id"`
	IsError   bool            `json:"is_error"`
	Content   json.RawMessage `json:"content"`
}

// chatEntry is what the runner sends for one transcript line: the same names
// as Claude Code's own, so the console reads one shape, with everything the
// view does not draw left out.
type chatEntry struct {
	Type             string      `json:"type"`
	UUID             string      `json:"uuid,omitempty"`
	Timestamp        string      `json:"timestamp,omitempty"`
	IsMeta           bool        `json:"isMeta,omitempty"`
	IsSidechain      bool        `json:"isSidechain,omitempty"`
	IsCompactSummary bool        `json:"isCompactSummary,omitempty"`
	Message          chatMessage `json:"message"`
}

type chatMessage struct {
	ID      string `json:"id,omitempty"`
	Role    string `json:"role"`
	Model   string `json:"model,omitempty"`
	Content any    `json:"content"`
}

type chatBlock struct {
	Type      string `json:"type"`
	Text      string `json:"text,omitempty"`
	Thinking  string `json:"thinking,omitempty"`
	ID        string `json:"id,omitempty"`
	Name      string `json:"name,omitempty"`
	Input     any    `json:"input,omitempty"`
	ToolUseID string `json:"tool_use_id,omitempty"`
	IsError   bool   `json:"is_error,omitempty"`
	Content   string `json:"content,omitempty"`
	Truncated bool   `json:"truncated,omitempty"`
}

// compactClaude turns one transcript line into a chat entry, or reports none
// for a line the chat does not show: the CLI's bookkeeping, a message with
// nothing left in it. A pasted image is named and never sent, an empty
// thinking block (the CLI keeps only its signature) is dropped, and long text
// is cut at a rune boundary with the block marked truncated.
func compactClaude(line []byte) ([]byte, bool) {
	var in claudeChatLine
	if json.Unmarshal(line, &in) != nil || in.Message == nil {
		return nil, false
	}
	if in.Type != "user" && in.Type != "assistant" {
		return nil, false
	}
	out := chatEntry{
		Type: in.Type, UUID: in.UUID, Timestamp: in.Timestamp,
		IsMeta: in.IsMeta, IsSidechain: in.IsSidechain, IsCompactSummary: in.IsCompactSummary,
		Message: chatMessage{ID: in.Message.ID, Role: in.Message.Role, Model: in.Message.Model},
	}
	var text string
	if json.Unmarshal(in.Message.Content, &text) == nil {
		if text == "" {
			return nil, false
		}
		cut, _ := truncate(text, chatTextMax)
		out.Message.Content = cut
	} else {
		var blocks []claudeBlock
		if json.Unmarshal(in.Message.Content, &blocks) != nil {
			return nil, false
		}
		kept := make([]chatBlock, 0, len(blocks))
		for _, block := range blocks {
			if compact, ok := compactBlock(block); ok {
				kept = append(kept, compact)
			}
		}
		if len(kept) == 0 {
			return nil, false
		}
		out.Message.Content = kept
	}
	encoded, err := json.Marshal(out)
	if err != nil {
		return nil, false
	}
	return encoded, true
}

func compactBlock(block claudeBlock) (chatBlock, bool) {
	switch block.Type {
	case "text":
		if block.Text == "" {
			return chatBlock{}, false
		}
		text, cut := truncate(block.Text, chatTextMax)
		return chatBlock{Type: "text", Text: text, Truncated: cut}, true
	case "thinking":
		if block.Thinking == "" {
			return chatBlock{}, false
		}
		text, cut := truncate(block.Thinking, chatThinkingMax)
		return chatBlock{Type: "thinking", Thinking: text, Truncated: cut}, true
	case "tool_use":
		var input any
		_ = json.Unmarshal(block.Input, &input)
		input, cut := compactValue(input, chatToolInputMax)
		return chatBlock{Type: "tool_use", ID: block.ID, Name: block.Name, Input: input, Truncated: cut}, true
	case "tool_result":
		text, cut := truncate(resultText(block.Content), chatToolResultMax)
		return chatBlock{Type: "tool_result", ToolUseID: block.ToolUseID, IsError: block.IsError, Content: text, Truncated: cut}, true
	case "image", "document":
		return chatBlock{Type: block.Type}, true
	}
	return chatBlock{}, false
}

// resultText is a tool result's text: the string it is, or its text blocks
// joined, with an image in it named.
func resultText(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	var blocks []claudeBlock
	if json.Unmarshal(raw, &blocks) != nil {
		return ""
	}
	joined := ""
	for _, block := range blocks {
		part := block.Text
		if block.Type == "image" {
			part = "[image]"
		}
		if part == "" {
			continue
		}
		if joined != "" {
			joined += "\n"
		}
		joined += part
	}
	return joined
}

// compactValue cuts every string in a tool's input to max bytes, which keeps
// a short command whole and a file the tool wrote to its head.
func compactValue(value any, max int) (any, bool) {
	switch v := value.(type) {
	case string:
		return truncate(v, max)
	case []any:
		cut := false
		for i, item := range v {
			var c bool
			v[i], c = compactValue(item, max)
			cut = cut || c
		}
		return v, cut
	case map[string]any:
		cut := false
		for key, item := range v {
			var c bool
			v[key], c = compactValue(item, max)
			cut = cut || c
		}
		return v, cut
	}
	return value, false
}

// truncate cuts s to at most max bytes without splitting a rune.
func truncate(s string, max int) (string, bool) {
	if len(s) <= max {
		return s, false
	}
	end := max
	for end > 0 && !utf8.RuneStart(s[end]) {
		end--
	}
	return s[:end], true
}
