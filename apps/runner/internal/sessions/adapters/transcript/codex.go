package transcript

import (
	"bufio"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Codex keeps each conversation as a "rollout", one JSON line per thing that
// happened, in `sessions/YYYY/MM/DD/rollout-<time>-<id>.jsonl` under its
// home. Nothing names it after the session (Codex picks its own id and is
// resumed with `resume --last`), so the session's rollout is the newest one
// whose first line, `session_meta`, was written in the session's directory,
// and written to since the session was created. A session's directory is its
// own and never reused, so that is this session's conversation, `/new`
// included.
//
// Each line is a `{timestamp, type, payload}`. What the chat reads:
// `event_msg` `user_message` (what the person typed; the `response_item`
// user messages also carry the context Codex injects), `response_item`
// assistant messages, reasoning summaries, tool calls and their outputs,
// web searches, `turn_aborted` (a stopped turn), `compacted`, and
// `token_count`, whose context and plan windows become the chat's status.
const (
	// codexScanEvery is how often the rollouts are looked through again for
	// a newer one: a check reads the folder of each day since the session
	// began, and the chat is only waiting for `/new` here.
	codexScanEvery = 2 * time.Second
	// codexScanDays bounds how many days of folders a scan reads, for a
	// session that has been open a long while.
	codexScanDays = 31
	// codexHeadMax bounds the read of a rollout's first line, which carries
	// the instructions Codex started with.
	codexHeadMax = 1 << 20
)

// codexSource is Codex's rollouts, under its `sessions/` folder.
type codexSource struct {
	sessions string
	// heads are the first lines of the rollouts read for subagents, kept
	// once read.
	heads *codexHeads
}

func (c codexSource) finder(session domain.Session) (func() string, bool) {
	cwd := session.Cwd()
	if cwd == "" {
		return nil, false
	}
	scan := &codexScan{root: c.sessions, dirs: sameDirectory(cwd), since: session.Created, heads: map[string]codexHead{}}
	return scan.find, true
}

func (codexSource) transcriber() chatTranscriber {
	return &codexChat{calls: map[string][]string{}}
}

// sameDirectory is the forms a directory a CLI records may take: as given,
// and with its links resolved, which is how a process finds its own.
func sameDirectory(dir string) map[string]bool {
	forms := map[string]bool{filepath.Clean(dir): true}
	if resolved, err := filepath.EvalSymlinks(dir); err == nil {
		forms[resolved] = true
	}
	return forms
}

// codexScan finds one session's rollout, and remembers each rollout's
// directory once read, so a scan reads only the first line of a new file.
type codexScan struct {
	root  string
	dirs  map[string]bool
	since time.Time
	heads map[string]codexHead
	at    time.Time
	found string
}

func (s *codexScan) find() string {
	if !s.at.IsZero() && time.Since(s.at) < codexScanEvery {
		return s.found
	}
	now := time.Now()
	s.at = now
	from := s.since.Add(-24 * time.Hour)
	if earliest := now.AddDate(0, 0, -codexScanDays); from.Before(earliest) {
		from = earliest
	}
	var best string
	var bestAt time.Time
	// Codex names the day's folder by local time; a day either side covers a
	// session that crossed midnight or a clock that disagrees.
	for day := midnight(from); !day.After(now.Add(24 * time.Hour)); day = day.AddDate(0, 0, 1) {
		folder := filepath.Join(s.root, day.Format("2006"), day.Format("01"), day.Format("02"))
		entries, err := os.ReadDir(folder)
		if err != nil {
			continue
		}
		for _, entry := range entries {
			name := entry.Name()
			if !strings.HasPrefix(name, "rollout-") || !strings.HasSuffix(name, ".jsonl") {
				continue
			}
			info, err := entry.Info()
			if err != nil || info.ModTime().Before(s.since) {
				continue
			}
			path := filepath.Join(folder, name)
			head, ok := s.heads[path]
			if !ok {
				if head, ok = codexHeadOf(path); ok {
					s.heads[path] = head
				}
			}
			// A subagent's rollout runs in the same directory, and is the
			// conversation's own, under it (`codex_subagents.go`).
			if !ok || head.child() || !s.dirs[filepath.Clean(head.Cwd)] {
				continue
			}
			if best == "" || info.ModTime().After(bestAt) {
				best, bestAt = path, info.ModTime()
			}
		}
	}
	s.found = best
	return best
}

func midnight(t time.Time) time.Time {
	year, month, day := t.Date()
	return time.Date(year, month, day, 0, 0, 0, 0, t.Location())
}

// codexHead is a rollout's first line, its `session_meta`: where the
// conversation ran, its thread, and for a subagent's, the thread that
// started it and what it was named.
type codexHead struct {
	Cwd            string `json:"cwd"`
	ID             string `json:"id"`
	ParentThreadID string `json:"parent_thread_id"`
	Source         struct {
		Subagent struct {
			ThreadSpawn *struct {
				ParentThreadID string `json:"parent_thread_id"`
				AgentPath      string `json:"agent_path"`
				AgentNickname  string `json:"agent_nickname"`
				AgentRole      string `json:"agent_role"`
			} `json:"thread_spawn"`
		} `json:"subagent"`
	} `json:"source"`
}

// parent is the thread that started this one; "" for a conversation of its own.
func (h codexHead) parent() string {
	if spawn := h.Source.Subagent.ThreadSpawn; spawn != nil && spawn.ParentThreadID != "" {
		return spawn.ParentThreadID
	}
	return h.ParentThreadID
}

// child is whether another thread started this one.
func (h codexHead) child() bool { return h.parent() != "" }

// codexHeadOf is a rollout's `session_meta`, off its first line; false when
// that line is not one (yet).
func codexHeadOf(path string) (codexHead, bool) {
	file, err := os.Open(path) //nolint:gosec // a rollout under Codex's own sessions folder
	if err != nil {
		return codexHead{}, false
	}
	defer func() { _ = file.Close() }()
	scanner := bufio.NewScanner(io.LimitReader(file, codexHeadMax))
	scanner.Buffer(make([]byte, 64<<10), codexHeadMax)
	if !scanner.Scan() {
		return codexHead{}, false
	}
	var line struct {
		Type    string    `json:"type"`
		Payload codexHead `json:"payload"`
	}
	if json.Unmarshal(scanner.Bytes(), &line) != nil || line.Type != "session_meta" {
		return codexHead{}, false
	}
	return line.Payload, true
}

// codexLine is one line of a rollout, its payload read loosely: each type
// uses a few of these fields.
type codexLine struct {
	Timestamp string          `json:"timestamp"`
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
}

type codexText struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type codexPayload struct {
	Type      string          `json:"type"`
	Role      string          `json:"role"`
	Content   []codexText     `json:"content"`
	Summary   []codexText     `json:"summary"`
	Name      string          `json:"name"`
	Arguments string          `json:"arguments"`
	Input     string          `json:"input"`
	CallID    string          `json:"call_id"`
	ID        string          `json:"id"`
	Output    json.RawMessage `json:"output"`
	Action    *struct {
		Type    string   `json:"type"`
		Query   string   `json:"query"`
		URL     string   `json:"url"`
		Command []string `json:"command"`
	} `json:"action"`
	Message string   `json:"message"`
	Images  []string `json:"images"`
	Model   string   `json:"model"`
	Info    *struct {
		LastTokenUsage *struct {
			InputTokens  int64 `json:"input_tokens"`
			OutputTokens int64 `json:"output_tokens"`
			TotalTokens  int64 `json:"total_tokens"`
		} `json:"last_token_usage"`
		ModelContextWindow int64 `json:"model_context_window"`
	} `json:"info"`
	RateLimits *struct {
		Primary   *codexWindow `json:"primary"`
		Secondary *codexWindow `json:"secondary"`
	} `json:"rate_limits"`
}

// codexWindow is one of the plan's usage windows as Codex reports it.
type codexWindow struct {
	UsedPercent   float64 `json:"used_percent"`
	WindowMinutes int64   `json:"window_minutes"`
	ResetsAt      int64   `json:"resets_at"`
}

// codexChat reads one rollout from its start. It keeps the model the turn
// runs (`turn_context`), and the entries each call became, so its output
// lands on each.
type codexChat struct {
	model string
	lines int
	calls map[string][]string
}

func (c *codexChat) quiet(time.Duration, int) [][]byte { return nil }

func (c *codexChat) holds() bool { return false }

func (c *codexChat) line(raw []byte, _ int) [][]byte {
	c.lines++
	var line codexLine
	if json.Unmarshal(raw, &line) != nil {
		return nil
	}
	var p codexPayload
	if json.Unmarshal(line.Payload, &p) != nil {
		return nil
	}
	id := "codex-" + strconv.Itoa(c.lines)
	at := line.Timestamp
	switch line.Type {
	case "turn_context":
		if p.Model != "" {
			c.model = p.Model
		}
		return nil
	case "compacted":
		return encode(chatEntry{
			Type: "user", UUID: id, Timestamp: at, IsCompactSummary: true,
			Message: chatMessage{Role: "user", Content: "compacted"},
		})
	case "event_msg":
		return c.event(id, at, p)
	case "response_item":
		return c.item(id, at, p)
	}
	return nil
}

func (c *codexChat) event(id, at string, p codexPayload) [][]byte {
	switch p.Type {
	case "user_message":
		if strings.TrimSpace(p.Message) == "" && len(p.Images) == 0 {
			return nil
		}
		blocks := []chatBlock{}
		if p.Message != "" {
			text, cut := truncate(p.Message, chatTextMax)
			blocks = append(blocks, chatBlock{Type: "text", Text: text, Truncated: cut})
		}
		for range p.Images {
			blocks = append(blocks, chatBlock{Type: "image"})
		}
		return userEntry(id, at, blocks)
	case "turn_aborted":
		return encode(chatEntry{Type: "user", UUID: id, Timestamp: at, Message: chatMessage{Role: "user", Content: interruptedText}})
	case "token_count":
		return codexStatus(p)
	}
	return nil
}

func (c *codexChat) item(id, at string, p codexPayload) [][]byte {
	switch p.Type {
	case "message":
		if p.Role != "assistant" {
			return nil
		}
		var parts []string
		for _, part := range p.Content {
			if part.Text != "" {
				parts = append(parts, part.Text)
			}
		}
		if len(parts) == 0 {
			return nil
		}
		text, cut := truncate(strings.Join(parts, "\n\n"), chatTextMax)
		return c.say(id, at, chatBlock{Type: "text", Text: text, Truncated: cut})
	case "reasoning":
		var parts []string
		for _, part := range p.Summary {
			if part.Text != "" {
				parts = append(parts, part.Text)
			}
		}
		if len(parts) == 0 {
			return nil
		}
		text, cut := truncate(strings.Join(parts, "\n\n"), chatThinkingMax)
		return c.say(id, at, chatBlock{Type: "thinking", Thinking: text, Truncated: cut})
	case "function_call":
		var args map[string]any
		_ = json.Unmarshal([]byte(p.Arguments), &args)
		return c.call(id, at, p.CallID, p.Name, args)
	case "custom_tool_call":
		return c.call(id, at, p.CallID, p.Name, map[string]any{"input": p.Input})
	case "local_shell_call":
		var command []string
		if p.Action != nil {
			command = p.Action.Command
		}
		return c.call(id, at, p.CallID, "Bash", map[string]any{"command": codexCommand(command)})
	case "function_call_output", "custom_tool_call_output":
		text, failed := codexOutput(p.Output)
		return c.result(at, p.CallID, text, failed)
	case "web_search_call":
		if p.Action == nil || (p.Action.Query == "" && p.Action.URL == "") {
			return nil
		}
		callID := p.ID
		if callID == "" {
			callID = id
		}
		name, input := "WebSearch", map[string]any{"query": p.Action.Query}
		if p.Action.Query == "" {
			name, input = "WebFetch", map[string]any{"url": p.Action.URL}
		}
		entries := c.call(id, at, callID, name, input)
		return append(entries, c.result(at, callID, "", false)...)
	}
	return nil
}

// say is one assistant entry.
func (c *codexChat) say(id, at string, blocks ...chatBlock) [][]byte {
	return encode(chatEntry{
		Type: "assistant", UUID: id, Timestamp: at,
		Message: chatMessage{Role: "assistant", Model: c.model, Content: blocks},
	})
}

// call is a tool call as the chat knows it: one `tool_use`, or one per file
// for a patch that touches several. The ids are remembered for its output.
func (c *codexChat) call(id, at, callID, name string, args map[string]any) [][]byte {
	if callID == "" {
		callID = id
	}
	uses := codexTool(name, args)
	blocks := make([]chatBlock, 0, len(uses))
	ids := make([]string, 0, len(uses))
	for n, use := range uses {
		useID := callID
		if n > 0 {
			useID = callID + "#" + strconv.Itoa(n+1)
		}
		input, cut := compactValue(use.input, chatToolInputMax)
		blocks = append(blocks, chatBlock{Type: "tool_use", ID: useID, Name: use.name, Input: input, Truncated: cut})
		ids = append(ids, useID)
	}
	c.calls[callID] = ids
	return c.say(id, at, blocks...)
}

// result is a call's output on each entry the call became, as `tool_result`
// on a user line, which is where the chat pairs it.
func (c *codexChat) result(at, callID, text string, failed bool) [][]byte {
	ids := c.calls[callID]
	if len(ids) == 0 {
		ids = []string{callID}
	}
	delete(c.calls, callID)
	content, cut := truncate(text, chatToolResultMax)
	blocks := make([]chatBlock, len(ids))
	for n, useID := range ids {
		blocks[n] = chatBlock{Type: "tool_result", ToolUseID: useID, IsError: failed, Content: content, Truncated: cut}
	}
	return userEntry(callID+":result", at, blocks)
}

func userEntry(id, at string, blocks []chatBlock) [][]byte {
	if len(blocks) == 0 {
		return nil
	}
	return encode(chatEntry{Type: "user", UUID: id, Timestamp: at, Message: chatMessage{Role: "user", Content: blocks}})
}

func encode(entry chatEntry) [][]byte {
	encoded, err := json.Marshal(entry)
	if err != nil {
		return nil
	}
	return [][]byte{encoded}
}

// codexStatus is a token count as the chat's status entry (`status.go`'s
// shape, which Claude Code's status line fills): how full the context is,
// and the plan's windows, the 5-hour one and the weekly one by their length.
func codexStatus(p codexPayload) [][]byte {
	status := map[string]any{"type": StatusEntryType}
	if info := p.Info; info != nil && info.LastTokenUsage != nil && info.ModelContextWindow > 0 {
		used := info.LastTokenUsage.TotalTokens
		if used == 0 {
			used = info.LastTokenUsage.InputTokens + info.LastTokenUsage.OutputTokens
		}
		status["context_window"] = map[string]any{
			"used_percentage":     min(100, float64(used)*100/float64(info.ModelContextWindow)),
			"context_window_size": info.ModelContextWindow,
		}
	}
	if limits := p.RateLimits; limits != nil {
		windows := map[string]any{}
		for n, window := range []*codexWindow{limits.Primary, limits.Secondary} {
			if window == nil {
				continue
			}
			name := "five_hour"
			if window.WindowMinutes > 24*60 || (window.WindowMinutes == 0 && n == 1) {
				name = "seven_day"
			}
			limit := map[string]any{"used_percentage": window.UsedPercent}
			if window.ResetsAt > 0 {
				limit["resets_at"] = window.ResetsAt
			}
			windows[name] = limit
		}
		if len(windows) > 0 {
			status["rate_limits"] = windows
		}
	}
	if len(status) == 1 {
		return nil
	}
	encoded, err := json.Marshal(status)
	if err != nil {
		return nil
	}
	return [][]byte{encoded}
}

// codexUse is one `tool_use` a Codex call becomes.
type codexUse struct {
	name  string
	input map[string]any
}

// codexTool is a Codex call as the chat knows it: its commands as `Bash`,
// its plan as `TodoWrite`, an image it looked at as `Read`, and a patch as
// an `Edit` per file it changes (a `Write` for a file it adds). Any other
// call keeps its name and its arguments.
func codexTool(name string, args map[string]any) []codexUse {
	switch name {
	case "shell", "container.exec", "local_shell":
		var command []string
		if parts, ok := args["command"].([]any); ok {
			for _, part := range parts {
				if word, ok := part.(string); ok {
					command = append(command, word)
				}
			}
		}
		return []codexUse{{"Bash", map[string]any{"command": codexCommand(command)}}}
	case "shell_command":
		return []codexUse{{"Bash", map[string]any{"command": args["command"]}}}
	case "exec_command":
		return []codexUse{{"Bash", map[string]any{"command": args["cmd"]}}}
	case "update_plan":
		var todos []any
		if plan, ok := args["plan"].([]any); ok {
			for _, raw := range plan {
				if step, ok := raw.(map[string]any); ok {
					todos = append(todos, map[string]any{"content": step["step"], "status": step["status"]})
				}
			}
		}
		return []codexUse{{"TodoWrite", map[string]any{"todos": todos}}}
	case "view_image":
		return []codexUse{{"Read", map[string]any{"file_path": args["path"]}}}
	case "apply_patch":
		patch, _ := args["input"].(string)
		if patch == "" {
			patch, _ = args["patch"].(string)
		}
		if files := codexPatch(patch); len(files) > 0 {
			return files
		}
	}
	return []codexUse{{name, args}}
}

// codexCommand is a command Codex ran, as a person would type it: the
// script of a `bash -lc <script>`, else its words.
func codexCommand(command []string) string {
	if len(command) == 3 && (command[1] == "-lc" || command[1] == "-c") {
		switch filepath.Base(command[0]) {
		case "bash", "sh", "zsh":
			return command[2]
		}
	}
	return strings.Join(command, " ")
}

var codexPatchFile = regexp.MustCompile(`^\*\*\* (Add|Update|Delete) File: (.+)$`)

// codexPatch is a patch in Codex's own format (`*** Begin Patch`), as one
// call per file: what it removed and added, for the chat's line counts.
func codexPatch(patch string) []codexUse {
	type file struct {
		op, path       string
		added, removed []string
	}
	var files []*file
	var current *file
	for _, line := range strings.Split(patch, "\n") {
		if match := codexPatchFile.FindStringSubmatch(line); match != nil {
			current = &file{op: match[1], path: strings.TrimSpace(match[2])}
			files = append(files, current)
			continue
		}
		if current == nil || strings.HasPrefix(line, "***") {
			continue
		}
		switch {
		case strings.HasPrefix(line, "+"):
			current.added = append(current.added, line[1:])
		case strings.HasPrefix(line, "-"):
			current.removed = append(current.removed, line[1:])
		}
	}
	uses := make([]codexUse, 0, len(files))
	for _, f := range files {
		switch f.op {
		case "Add":
			uses = append(uses, codexUse{"Write", map[string]any{"file_path": f.path, "content": strings.Join(f.added, "\n")}})
		case "Update":
			uses = append(uses, codexUse{"Edit", map[string]any{
				"file_path": f.path, "old_string": strings.Join(f.removed, "\n"), "new_string": strings.Join(f.added, "\n"),
			}})
		default:
			uses = append(uses, codexUse{"Delete", map[string]any{"file_path": f.path}})
		}
	}
	return uses
}

var codexExitCode = regexp.MustCompile(`(?m)^(?:Exit code|Process exited with code):? (-?\d+)`)

// codexOutput is a call's output as text, and whether it failed: Codex
// writes it as plain text (a command's with its exit code and wall time
// ahead of `Output:`), as JSON text holding the output and its exit code, or
// as `{content, success}`.
func codexOutput(raw json.RawMessage) (string, bool) {
	var text string
	if json.Unmarshal(raw, &text) != nil {
		var object struct {
			Content json.RawMessage `json:"content"`
			Success *bool           `json:"success"`
		}
		if json.Unmarshal(raw, &object) != nil {
			return "", false
		}
		text = codexContent(object.Content)
		if object.Success != nil && !*object.Success {
			return text, true
		}
	}
	var wrapped struct {
		Output   *string `json:"output"`
		Metadata struct {
			ExitCode *int `json:"exit_code"`
		} `json:"metadata"`
	}
	if strings.HasPrefix(strings.TrimSpace(text), "{") && json.Unmarshal([]byte(text), &wrapped) == nil && wrapped.Output != nil {
		failed := wrapped.Metadata.ExitCode != nil && *wrapped.Metadata.ExitCode != 0
		return *wrapped.Output, failed
	}
	failed := false
	if match := codexExitCode.FindStringSubmatch(text); match != nil {
		failed = match[1] != "0"
	}
	if _, after, ok := strings.Cut(text, "\nOutput:\n"); ok {
		text = after
	}
	return text, failed
}

// codexContent is a call's output given as content items, its text joined.
func codexContent(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return text
	}
	var items []codexText
	if json.Unmarshal(raw, &items) != nil {
		return ""
	}
	parts := make([]string, 0, len(items))
	for _, item := range items {
		if item.Text != "" {
			parts = append(parts, item.Text)
		}
	}
	return strings.Join(parts, "\n")
}
