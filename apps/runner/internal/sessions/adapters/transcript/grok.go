package transcript

import (
	"encoding/json"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Grok keeps each session in `sessions/<encoded cwd>/<session id>/` under
// its home, and the conversation there as `updates.jsonl`: the Agent Client
// Protocol's session updates, one a line, as its own clients are sent them.
// The session's id is the one the runner launched it with (`--session-id`),
// so the folder is found by that name, whichever directory it is filed under.
//
// ACP sends what the agent says and thinks as chunks, a word or a few at a
// time, so the chat's entries are made of runs: a run of one kind of chunk
// is one reply, one thought or one prompt, sent once a different update
// arrives or the file has been quiet for grokQuiet. A tool call is an
// `Edit`, `Bash` or the like by its ACP kind and its raw input, sent once it
// runs and again, as its result, once it has ended; an edit waits for its
// end, which is when its diff is known. A plan is the chat's task list.
const grokQuiet = 1500 * time.Millisecond

// grokSource is Grok's sessions, under its `sessions/` folder.
type grokSource struct {
	sessions string
}

func (g grokSource) finder(session domain.Session) (func() string, bool) {
	conversation := session.Launch.Conversation
	if !conversationPattern.MatchString(conversation) {
		return nil, false
	}
	return func() string {
		matches, err := filepath.Glob(filepath.Join(g.sessions, "*", conversation, "updates.jsonl"))
		if err != nil {
			return ""
		}
		return newest(matches)
	}, true
}

func (grokSource) transcriber() chatTranscriber {
	return &grokChat{tools: map[string]*grokCall{}}
}

// acpUpdate is one ACP session update, read loosely: each kind uses a few of
// these fields.
type acpUpdate struct {
	SessionUpdate string          `json:"sessionUpdate"`
	Content       json.RawMessage `json:"content"`
	ToolCallID    string          `json:"toolCallId"`
	Title         string          `json:"title"`
	Kind          string          `json:"kind"`
	Status        string          `json:"status"`
	RawInput      json.RawMessage `json:"rawInput"`
	RawOutput     json.RawMessage `json:"rawOutput"`
	Locations     []struct {
		Path string `json:"path"`
	} `json:"locations"`
	Entries []struct {
		Content string `json:"content"`
		Status  string `json:"status"`
	} `json:"entries"`
}

// acpContent is a content block, or a tool call's content item, which wraps
// a block (`content`) or is a diff of one file.
type acpContent struct {
	Type    string          `json:"type"`
	Text    string          `json:"text"`
	Content json.RawMessage `json:"content"`
	Path    string          `json:"path"`
	OldText *string         `json:"oldText"`
	NewText string          `json:"newText"`
}

// grokCall is what is known of one tool call so far: the call and its
// updates merged, and how far it has been sent.
type grokCall struct {
	title, kind, status string
	input               map[string]any
	output              []string
	rawOutput           json.RawMessage
	path                string
	oldText             *string
	newText             string
	diff                bool
	at                  string
	sent                int
}

// grokRuns is the run each kind of chunk belongs to.
var grokRuns = map[string]string{
	"user_message_chunk":  "user",
	"agent_message_chunk": "agent",
	"agent_thought_chunk": "thought",
}

// grokChat reads one session's updates from its start.
type grokChat struct {
	lines int
	// run is the chunks of one kind not yet sent: "user", "agent" or
	// "thought", their text, and how many images came with it.
	run      string
	runText  strings.Builder
	runFiles int
	runID    string
	runAt    string
	tools    map[string]*grokCall
}

func (g *grokChat) line(raw []byte, _ int) [][]byte {
	g.lines++
	update, at := acpOf(raw)
	if update == nil {
		return nil
	}
	id := "grok-" + strconv.Itoa(g.lines)
	switch update.SessionUpdate {
	case "user_message_chunk", "agent_message_chunk", "agent_thought_chunk":
		kind := grokRuns[update.SessionUpdate]
		var out [][]byte
		if kind != g.run {
			out = g.flush()
			g.run, g.runID, g.runAt = kind, id, at
		}
		var block acpContent
		if json.Unmarshal(update.Content, &block) == nil {
			switch block.Type {
			case "text":
				g.runText.WriteString(block.Text)
			case "image", "resource", "resource_link":
				g.runFiles++
			}
		}
		return out
	case "tool_call", "tool_call_update":
		out := g.flush()
		return append(out, g.call(update, at)...)
	case "plan":
		out := g.flush()
		var todos []any
		for _, entry := range update.Entries {
			todos = append(todos, map[string]any{"content": entry.Content, "status": entry.Status})
		}
		out = append(out, assistantEntry(id, at, chatBlock{Type: "tool_use", ID: id, Name: "TodoWrite", Input: map[string]any{"todos": todos}})...)
		return append(out, userEntry(id+":result", at, []chatBlock{{Type: "tool_result", ToolUseID: id}})...)
	}
	return nil
}

func (g *grokChat) quiet(since time.Duration, _ int) [][]byte {
	if since < grokQuiet {
		return nil
	}
	return g.flush()
}

// flush sends the run of chunks held: a prompt, a reply or a thought.
func (g *grokChat) flush() [][]byte {
	kind, text, files, id, at := g.run, g.runText.String(), g.runFiles, g.runID, g.runAt
	g.run, g.runFiles = "", 0
	g.runText.Reset()
	if strings.TrimSpace(text) == "" && files == 0 {
		return nil
	}
	switch kind {
	case "user":
		var blocks []chatBlock
		if strings.TrimSpace(text) != "" {
			cut, truncated := truncate(text, chatTextMax)
			blocks = append(blocks, chatBlock{Type: "text", Text: cut, Truncated: truncated})
		}
		for range files {
			blocks = append(blocks, chatBlock{Type: "image"})
		}
		return userEntry(id, at, blocks)
	case "agent":
		cut, truncated := truncate(text, chatTextMax)
		return assistantEntry(id, at, chatBlock{Type: "text", Text: cut, Truncated: truncated})
	case "thought":
		cut, truncated := truncate(text, chatThinkingMax)
		return assistantEntry(id, at, chatBlock{Type: "thinking", Thinking: cut, Truncated: truncated})
	}
	return nil
}

// call merges a tool call's update into what is known of it, and sends the
// call once it runs and its result once it has ended.
func (g *grokChat) call(update *acpUpdate, at string) [][]byte {
	if update.ToolCallID == "" {
		return nil
	}
	call := g.tools[update.ToolCallID]
	if call == nil {
		call = &grokCall{at: at}
		g.tools[update.ToolCallID] = call
	}
	if update.Title != "" {
		call.title = update.Title
	}
	if update.Kind != "" {
		call.kind = update.Kind
	}
	if update.Status != "" {
		call.status = update.Status
	}
	var input map[string]any
	if json.Unmarshal(update.RawInput, &input) == nil && len(input) > 0 {
		call.input = input
	}
	if len(update.RawOutput) > 0 && string(update.RawOutput) != "null" {
		call.rawOutput = update.RawOutput
	}
	if call.path == "" && len(update.Locations) > 0 {
		call.path = update.Locations[0].Path
	}
	var items []acpContent
	if json.Unmarshal(update.Content, &items) == nil && len(items) > 0 {
		call.output = call.output[:0]
		for _, item := range items {
			switch item.Type {
			case "diff":
				call.diff, call.oldText, call.newText = true, item.OldText, item.NewText
				if item.Path != "" {
					call.path = item.Path
				}
			case "content":
				var block acpContent
				if json.Unmarshal(item.Content, &block) == nil && block.Text != "" {
					call.output = append(call.output, block.Text)
				}
			}
		}
	}
	ended := call.status == "completed" || call.status == "failed"
	var out [][]byte
	// A call is sent once it runs; an edit once it has ended, with its diff.
	runs := call.status == "in_progress" || ended || (len(call.input) > 0 && call.kind != "edit" && call.kind != "delete")
	if call.sent == 0 && runs && (ended || (call.kind != "edit" && call.kind != "delete")) {
		name, input := grokTool(call)
		compact, cut := compactValue(input, chatToolInputMax)
		out = append(out, assistantEntry(update.ToolCallID, call.at, chatBlock{
			Type: "tool_use", ID: update.ToolCallID, Name: name, Input: compact, Truncated: cut,
		})...)
		call.sent = sentCall
	}
	if call.sent == sentCall && ended {
		text, cut := truncate(grokOutput(call), chatToolResultMax)
		out = append(out, userEntry(update.ToolCallID+":result", at, []chatBlock{{
			Type: "tool_result", ToolUseID: update.ToolCallID, IsError: call.status == "failed", Content: text, Truncated: cut,
		}})...)
		call.sent = sentAll
		delete(g.tools, update.ToolCallID)
	}
	return out
}

// grokTool is a call as the chat knows it, by its ACP kind and its raw input:
// commands as `Bash`, reads as `Read`, edits as `Edit` (a `Write` for a new
// file), searches as `Grep` or `LS`, the web as `WebFetch` or `WebSearch`, a
// task list as `TodoWrite`, a subagent as `Task`. Any other keeps its title.
func grokTool(call *grokCall) (string, map[string]any) {
	in := call.input
	if in == nil {
		in = map[string]any{}
	}
	path := grokField(in, "file_path", "target_file", "path", "filePath", "file")
	if path == "" {
		path = call.path
	}
	if todos, ok := in["todos"].([]any); ok {
		return "TodoWrite", map[string]any{"todos": todos}
	}
	if _, ok := in["subagent_type"]; ok {
		return "Task", in
	}
	switch call.kind {
	case "execute":
		command := grokField(in, "command", "cmd")
		if command == "" {
			command = call.title
		}
		return "Bash", map[string]any{"command": command, "description": in["description"]}
	case "read":
		return "Read", map[string]any{"file_path": path}
	case "edit":
		if call.diff && (call.oldText == nil || *call.oldText == "") {
			return "Write", map[string]any{"file_path": path, "content": call.newText}
		}
		old, updated := grokField(in, "old_string", "oldString"), grokField(in, "new_string", "newString")
		if call.diff {
			old, updated = *call.oldText, call.newText
		}
		return "Edit", map[string]any{"file_path": path, "old_string": old, "new_string": updated}
	case "delete":
		return "Delete", map[string]any{"file_path": path}
	case "search":
		pattern := grokField(in, "pattern", "query", "regex", "glob_pattern")
		if pattern == "" {
			return "LS", map[string]any{"path": path}
		}
		return "Grep", map[string]any{"pattern": pattern, "path": path}
	case "fetch":
		if url := grokField(in, "url"); url != "" {
			return "WebFetch", map[string]any{"url": url}
		}
		return "WebSearch", map[string]any{"query": grokField(in, "query")}
	}
	name := call.title
	if name == "" {
		name = "tool"
	}
	return name, in
}

func grokField(in map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := in[key].(string); ok && value != "" {
			return value
		}
	}
	return ""
}

// grokOutput is what a call returned: its text content, else its raw output
// (the text it holds, or the JSON itself).
func grokOutput(call *grokCall) string {
	if len(call.output) > 0 {
		return strings.Join(call.output, "\n")
	}
	if len(call.rawOutput) == 0 {
		return ""
	}
	var text string
	if json.Unmarshal(call.rawOutput, &text) == nil {
		return text
	}
	var object map[string]any
	if json.Unmarshal(call.rawOutput, &object) == nil {
		if text := grokField(object, "output", "stdout", "content", "result", "text"); text != "" {
			return text
		}
	}
	return string(call.rawOutput)
}

// acpOf is a line's session update and when it was written: the update
// itself, or wrapped in a notification (`update`, or `params.update`).
func acpOf(raw []byte) (*acpUpdate, string) {
	var line map[string]json.RawMessage
	if json.Unmarshal(raw, &line) != nil {
		return nil, ""
	}
	at := grokStamp(line)
	body := raw
	if inner, ok := line["update"]; ok {
		body = inner
	} else if params, ok := line["params"]; ok {
		var wrapped struct {
			Update json.RawMessage `json:"update"`
		}
		if json.Unmarshal(params, &wrapped) == nil && len(wrapped.Update) > 0 {
			body = wrapped.Update
		}
	}
	var update acpUpdate
	if json.Unmarshal(body, &update) != nil || update.SessionUpdate == "" {
		return nil, ""
	}
	if at == "" {
		var inner map[string]json.RawMessage
		if json.Unmarshal(body, &inner) == nil {
			at = grokStamp(inner)
		}
	}
	return &update, at
}

// grokStamp is when a line was written, as the chat reads a time, off the
// first field that holds one: RFC 3339 text, or Unix seconds or
// milliseconds. "" when none does.
func grokStamp(fields map[string]json.RawMessage) string {
	for _, key := range []string{"timestamp", "ts", "time", "createdAt", "created_at"} {
		raw, ok := fields[key]
		if !ok {
			continue
		}
		var text string
		if json.Unmarshal(raw, &text) == nil {
			if at, err := time.Parse(time.RFC3339Nano, text); err == nil {
				return at.UTC().Format(time.RFC3339Nano)
			}
			continue
		}
		var number float64
		if json.Unmarshal(raw, &number) == nil && number > 0 {
			if number < 1e12 {
				number *= 1000
			}
			return time.UnixMilli(int64(number)).UTC().Format(time.RFC3339Nano)
		}
	}
	return ""
}

// assistantEntry is one assistant line of the chat's transcript. Grok's
// updates do not say which model answered, so the line names none.
func assistantEntry(id, at string, blocks ...chatBlock) [][]byte {
	return encode(chatEntry{
		Type: "assistant", UUID: id, Timestamp: at,
		Message: chatMessage{Role: "assistant", Content: blocks},
	})
}
