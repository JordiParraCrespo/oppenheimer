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
		Usage   *chatUsage      `json:"usage"`
	} `json:"message"`
}

// chatUsage is the tokens an assistant message was sent and wrote, in
// Claude Code's own names: what the context held when the agent answered,
// which the console reads as how full it is. Only the counts are kept.
type chatUsage struct {
	InputTokens              int64 `json:"input_tokens"`
	CacheCreationInputTokens int64 `json:"cache_creation_input_tokens,omitempty"`
	CacheReadInputTokens     int64 `json:"cache_read_input_tokens,omitempty"`
	OutputTokens             int64 `json:"output_tokens"`
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
	Source    json.RawMessage `json:"source"`
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
	ID      string     `json:"id,omitempty"`
	Role    string     `json:"role"`
	Model   string     `json:"model,omitempty"`
	Content any        `json:"content"`
	Usage   *chatUsage `json:"usage,omitempty"`
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
	// Source is an image's preview (previewImage); none when it did not fit.
	Source *chatImageSource `json:"source,omitempty"`
	// Images are the images a tool's result carried, in order, each with
	// its preview when it fit (a screenshot the agent read).
	Images []chatImage `json:"images,omitempty"`
	// sources are the transcript's own sources of the images the block
	// carries, one per slot (slots), never sent.
	sources []json.RawMessage
}

// slots are where the previews of the block's images go, in the order of
// its sources: an image block's own source, or each of a tool result's.
func (b *chatBlock) slots() []**chatImageSource {
	if b.Type == "image" {
		return []**chatImageSource{&b.Source}
	}
	slots := make([]**chatImageSource, len(b.Images))
	for i := range b.Images {
		slots[i] = &b.Images[i].Source
	}
	return slots
}

// chatImage is one image of a tool's result.
type chatImage struct {
	Source *chatImageSource `json:"source,omitempty"`
}

// chatEntry turns one transcript line into a chat entry, or reports none
// for a line the chat does not show: the CLI's bookkeeping, a message with
// nothing left in it. An empty thinking block (the CLI keeps only its
// signature) is dropped, and long text is cut at a rune boundary with the
// block marked truncated. An image, pasted or in a tool's result, is sent as
// a preview the entry's bytes still have room for, under max, and only named
// when none fits.
func (claudeReader) chatEntry(line []byte, max int) ([]byte, bool) {
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
	if in.Type == "assistant" {
		out.Message.Usage = in.Message.Usage
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
		images := 0
		for _, block := range blocks {
			if compact, ok := compactBlock(block); ok {
				kept = append(kept, compact)
				images += len(compact.sources)
			}
		}
		if len(kept) == 0 {
			return nil, false
		}
		out.Message.Content = kept
		encoded, err := json.Marshal(out)
		if err != nil {
			return nil, false
		}
		if images == 0 {
			return encoded, true
		}
		return withPreviews(out, kept, encoded, images, max)
	}
	encoded, err := json.Marshal(out)
	if err != nil {
		return nil, false
	}
	return encoded, true
}

// withPreviews fills in the previews of the entry's images, the room it
// has left under max shared between them, and encodes it again. An entry the
// previews took over max (they cannot, by their budget) goes without them.
func withPreviews(out chatEntry, kept []chatBlock, bare []byte, images, max int) ([]byte, bool) {
	share := (max - len(bare) - images*previewOverhead) / images
	if share < previewMinBytes {
		return bare, true
	}
	for i := range kept {
		for n, slot := range kept[i].slots() {
			*slot = previewImage(kept[i].sources[n], share)
		}
	}
	encoded, err := json.Marshal(out)
	if err != nil || len(encoded) > max {
		return bare, true
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
		sources := resultImages(block.Content)
		var images []chatImage
		if len(sources) > 0 {
			images = make([]chatImage, len(sources))
		}
		return chatBlock{Type: "tool_result", ToolUseID: block.ToolUseID, IsError: block.IsError, Content: text, Truncated: cut, Images: images, sources: sources}, true
	case "image":
		return chatBlock{Type: "image", sources: []json.RawMessage{block.Source}}, true
	case "document":
		return chatBlock{Type: "document"}, true
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

// resultImages is the source of each image a tool's result carries, in
// order: none for a result that is text.
func resultImages(raw json.RawMessage) []json.RawMessage {
	var blocks []claudeBlock
	if json.Unmarshal(raw, &blocks) != nil {
		return nil
	}
	var images []json.RawMessage
	for _, block := range blocks {
		if block.Type == "image" {
			images = append(images, block.Source)
		}
	}
	return images
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
