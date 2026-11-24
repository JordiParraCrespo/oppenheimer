package transcript

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Qwen Code keeps each conversation in `projects/<project>/chats/<session
// id>.jsonl` under its home, `<project>` being the folder it runs in with
// every character outside [A-Za-z0-9] a dash (`sanitizeCwd`), and creates
// the file with its first record, not at launch. Each line is one whole
// record: `{uuid, parentUuid, sessionId, timestamp, type, …}`, `message`
// in Gemini's `Content` shape (`{role, parts}`). The shape is Qwen's own
// and undocumented; this reads Qwen Code 0.28.4's, off the files real
// sessions wrote, and reads each field loosely by name.
//
// What the chat shows: a `user` record the person sent (`real_user`), an
// `assistant` record's parts (its text, a `thought` part as thinking, a
// `functionCall` as a tool call), and a `tool_result` record's
// `functionResponse`, an error when its `toolCallResult.status` is not
// `success`. Every `system` record (telemetry, snapshots, the memory
// catalog Qwen hands the model as a user message, a `/clear`, a rewind)
// is left out, line by line, so it can never take a place in a page.
//
// A rewind (Esc twice, "Restore conversation") appends a `rewind` record
// whose `parentUuid` is the turn it went back to, and leaves the turns it
// dropped in the file; the chat still shows them.
type qwenSource struct {
	projects string
}

// qwenNonAlnum is what `sanitizeCwd` replaces with a dash.
var qwenNonAlnum = regexp.MustCompile(`[^a-zA-Z0-9]`)

func (q qwenSource) finder(session domain.Session) (func() string, bool) {
	if !conversationPattern.MatchString(session.Launch.Conversation) {
		return nil, false
	}
	return func() string { return q.file(session) }, true
}

// conversation is the conversation the session's Qwen is in now, by the
// rule its chat follows, or "" while it has written none.
func (q qwenSource) conversation(session domain.Session) string {
	path := q.file(session)
	if path == "" {
		return ""
	}
	return strings.TrimSuffix(filepath.Base(path), ".jsonl")
}

// file is the session's conversation file, "" while there is none.
//
// Launched, it is the one named by the session's id (`--session-id`). But
// Qwen moves to a conversation of its own choosing on a `/clear`, and on a
// restart before anything was said (`--continue` with nothing saved), and
// a later `--continue` keeps to that one. In a worktree session, whose
// folder is its own and never reused, the newest conversation written
// there since the session was created is that one. In a folder another
// Qwen may share, the newest may be the other's, so only the named one is
// followed.
func (q qwenSource) file(session domain.Session) string {
	conversation := session.Launch.Conversation
	if !conversationPattern.MatchString(conversation) || q.projects == "" {
		return ""
	}
	named, _ := filepath.Glob(filepath.Join(q.projects, "*", "chats", conversation+".jsonl"))
	pinned := newest(named)
	if session.Place == domain.PlaceFolder {
		return pinned
	}
	if session.Cwd() == "" && pinned == "" {
		return ""
	}
	chats := filepath.Join(q.projects, qwenNonAlnum.ReplaceAllString(session.Cwd(), "-"), "chats")
	if pinned != "" {
		chats = filepath.Dir(pinned)
	}
	candidates, _ := filepath.Glob(filepath.Join(chats, "*.jsonl"))
	best, bestAt := pinned, int64(0)
	if info, err := os.Stat(pinned); pinned != "" && err == nil {
		bestAt = info.ModTime().UnixNano()
	}
	for _, path := range candidates {
		if path == pinned || !conversationPattern.MatchString(strings.TrimSuffix(filepath.Base(path), ".jsonl")) {
			continue
		}
		info, err := os.Stat(path)
		if err != nil || info.ModTime().Before(session.Created) || info.ModTime().UnixNano() <= bestAt {
			continue
		}
		if qwenInternal(path) {
			continue
		}
		best, bestAt = path, info.ModTime().UnixNano()
	}
	return best
}

// saved reports whether Qwen has written conversation down: its file is
// created with its first record, not at launch. An id it could not look
// for is SavingUnknown, which leaves the restart to `--continue`.
func (q qwenSource) saved(conversation string) domain.Saving {
	if !conversationPattern.MatchString(conversation) || q.projects == "" {
		return domain.SavingUnknown
	}
	named, err := filepath.Glob(filepath.Join(q.projects, "*", "chats", conversation+".jsonl"))
	switch {
	case err != nil:
		return domain.SavingUnknown
	case len(named) > 0:
		return domain.Saved
	default:
		return domain.NotSaved
	}
}

// qwenInternal reports a conversation Qwen keeps for one of its own agents
// rather than for the person (a `session_source` record naming `agent` or
// `agent-host`), which `--continue` passes over as well.
func qwenInternal(path string) bool {
	file, err := os.Open(path) //nolint:gosec // a conversation file under Qwen's own folder, its name checked by conversationPattern
	if err != nil {
		return false
	}
	defer func() { _ = file.Close() }()
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64<<10), 1<<20)
	for n := 0; n < 8 && scanner.Scan(); n++ {
		line := scanner.Bytes()
		if !bytes.Contains(line, []byte(`"session_source"`)) {
			continue
		}
		var record qwenRecord
		if json.Unmarshal(line, &record) == nil && record.Subtype == "session_source" {
			source := record.SystemPayload.SourceType
			return source == "agent" || source == "agent-host"
		}
	}
	return false
}

func (qwenSource) transcriber() chatTranscriber { return lineByLine(qwenEntry) }

// opensTurn implements turnCutter: a turn opens where the person sent
// something, so the console can page older turns.
func (qwenSource) opensTurn(line []byte) bool {
	if !bytes.Contains(line, []byte(`"real_user"`)) {
		return false
	}
	var record qwenRecord
	return json.Unmarshal(line, &record) == nil && record.Type == "user" && record.Provenance == "real_user"
}

// qwenRecord is one line of a Qwen conversation, read loosely.
type qwenRecord struct {
	UUID       string `json:"uuid"`
	Timestamp  string `json:"timestamp"`
	Type       string `json:"type"`
	Subtype    string `json:"subtype"`
	Provenance string `json:"provenance"`
	Model      string `json:"model"`
	Message    struct {
		Parts []qwenPart `json:"parts"`
	} `json:"message"`
	ToolCallResult struct {
		CallID string `json:"callId"`
		Status string `json:"status"`
	} `json:"toolCallResult"`
	SystemPayload struct {
		SourceType  string  `json:"sourceType"`
		DisplayText *string `json:"displayText"`
	} `json:"systemPayload"`
}

// qwenPart is one part of a message: text (a thought when `thought` is
// set), a file, a call to a tool, or a tool's response.
type qwenPart struct {
	Text         string          `json:"text"`
	Thought      bool            `json:"thought"`
	InlineData   json.RawMessage `json:"inlineData"`
	FileData     json.RawMessage `json:"fileData"`
	FunctionCall *struct {
		ID   string         `json:"id"`
		Name string         `json:"name"`
		Args map[string]any `json:"args"`
	} `json:"functionCall"`
	FunctionResponse *struct {
		ID       string          `json:"id"`
		Response json.RawMessage `json:"response"`
	} `json:"functionResponse"`
}

// qwenAdded matches what Qwen adds to a message after the person typed it,
// each block to its end marker or to the end: an `@file`'s contents, an MCP
// resource's, a UserPromptSubmit hook's context and a system reminder (its
// export and its transcript projection drop the same, 0.28.4).
var qwenAdded = regexp.MustCompile(`(?s)\n?--- Content from referenced files ---.*?(?:--- End of content ---|$)` +
	`|\n?--- Content from MCP resource [^\n]*---.*?(?:--- End of MCP resource [^\n]*---|$)` +
	`|<qwen:user-prompt-submit-context>.*?(?:</qwen:user-prompt-submit-context>|$)` +
	`|<system-reminder>.*?(?:</system-reminder>|$)`)

// qwenSaid is what the person said in a user record: the text Qwen kept to
// show (`systemPayload.displayText`) when it kept one, otherwise the text
// parts joined as Qwen joins them, without what it added. The parts of an
// `@file` message are the typed text, then the file's header, contents and
// end marker, each a part of its own (watched), so they are joined first.
func qwenSaid(record qwenRecord) string {
	if shown := record.SystemPayload.DisplayText; shown != nil {
		return *shown
	}
	var said strings.Builder
	for _, part := range record.Message.Parts {
		if !part.Thought {
			said.WriteString(part.Text)
		}
	}
	return strings.TrimRight(qwenAdded.ReplaceAllString(said.String(), ""), "\n")
}

// qwenEntry is one record as the chat's entry, or none.
func qwenEntry(raw []byte, max int) ([]byte, bool) {
	var record qwenRecord
	if json.Unmarshal(raw, &record) != nil || record.UUID == "" {
		return nil, false
	}
	var entries [][]byte
	switch record.Type {
	case "user":
		if record.Provenance != "" && record.Provenance != "real_user" {
			return nil, false
		}
		var blocks []chatBlock
		if said := qwenSaid(record); strings.TrimSpace(said) != "" {
			cut, truncated := truncate(said, chatTextMax)
			blocks = append(blocks, chatBlock{Type: "text", Text: cut, Truncated: truncated})
		}
		for _, part := range record.Message.Parts {
			if len(part.InlineData) > 0 || len(part.FileData) > 0 {
				blocks = append(blocks, chatBlock{Type: "image"})
			}
		}
		entries = userEntry(record.UUID, record.Timestamp, blocks)
	case "assistant":
		var blocks []chatBlock
		for _, part := range record.Message.Parts {
			switch {
			case part.FunctionCall != nil:
				name, input := qwenTool(part.FunctionCall.Name, part.FunctionCall.Args)
				compact, cut := compactValue(input, chatToolInputMax)
				blocks = append(blocks, chatBlock{Type: "tool_use", ID: part.FunctionCall.ID, Name: name, Input: compact, Truncated: cut})
			case part.Thought && strings.TrimSpace(part.Text) != "":
				cut, truncated := truncate(part.Text, chatThinkingMax)
				blocks = append(blocks, chatBlock{Type: "thinking", Thinking: cut, Truncated: truncated})
			case strings.TrimSpace(part.Text) != "":
				cut, truncated := truncate(part.Text, chatTextMax)
				blocks = append(blocks, chatBlock{Type: "text", Text: cut, Truncated: truncated})
			}
		}
		if len(blocks) == 0 {
			return nil, false
		}
		entries = encode(chatEntry{
			Type: "assistant", UUID: record.UUID, Timestamp: record.Timestamp,
			Message: chatMessage{Role: "assistant", Model: record.Model, Content: blocks},
		})
	case "tool_result":
		var blocks []chatBlock
		for _, part := range record.Message.Parts {
			if part.FunctionResponse == nil {
				continue
			}
			text, failed := qwenResponse(part.FunctionResponse.Response)
			cut, truncated := truncate(text, chatToolResultMax)
			id := part.FunctionResponse.ID
			if id == "" {
				id = record.ToolCallResult.CallID
			}
			failed = failed || (record.ToolCallResult.Status != "" && record.ToolCallResult.Status != "success")
			blocks = append(blocks, chatBlock{Type: "tool_result", ToolUseID: id, IsError: failed, Content: cut, Truncated: truncated})
		}
		entries = userEntry(record.UUID, record.Timestamp, blocks)
	}
	if len(entries) != 1 || len(entries[0]) > max {
		return nil, false
	}
	return entries[0], true
}

// qwenResponse is what a tool answered: `{output}`, or `{error}` for one
// that failed or was refused.
func qwenResponse(raw json.RawMessage) (string, bool) {
	var response map[string]any
	if json.Unmarshal(raw, &response) != nil {
		return string(raw), false
	}
	if text, ok := response["error"].(string); ok && text != "" {
		return text, true
	}
	if text, ok := response["output"].(string); ok {
		return text, false
	}
	if len(response) == 0 {
		return "", false
	}
	return string(raw), false
}

// qwenTool is a call as the chat knows it, by Qwen's tool names
// (`ToolNames`), whose arguments are already Claude Code's for the files
// (`file_path`, `old_string`, `new_string`); any other keeps its own name.
func qwenTool(name string, args map[string]any) (string, map[string]any) {
	if args == nil {
		args = map[string]any{}
	}
	switch name {
	case "run_shell_command":
		return "Bash", map[string]any{"command": args["command"], "description": args["description"]}
	case "read_file":
		return "Read", args
	case "write_file":
		return "Write", args
	case "edit":
		return "Edit", args
	case "grep_search":
		return "Grep", args
	case "glob":
		return "Glob", args
	case "list_directory":
		return "LS", args
	case "todo_write":
		return "TodoWrite", args
	case "agent":
		return "Task", args
	case "web_fetch":
		return "WebFetch", args
	case "web_search":
		return "WebSearch", args
	case "ask_user_question":
		return "AskUserQuestion", args
	case "exit_plan_mode":
		return "ExitPlanMode", args
	}
	if name == "" {
		name = "tool"
	}
	return name, args
}
