package transcript

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// OpenCode keeps its conversations in a database of its own, whose tables
// move between its versions, so the chat view reads them where OpenCode
// itself promises a shape: the API its TUI serves on a loopback port when it
// is launched with one (domain.AgentServer). The session's conversation is
// the newest root conversation OpenCode has for the session's directory,
// touched since the session first launched, so `/new` in the TUI is followed,
// and neither an older conversation in the same folder nor one in another
// worktree of the same repository (OpenCode keeps one store per repository)
// ever is.
//
// Each part of a message is sent once it is finished, as a line of the
// transcript the chat already reads (Claude Code's shape, `claude_chat.go`):
// the person's words as a user line, a reply or a thought as an assistant
// line, a tool call as `tool_use` once it runs and its result as
// `tool_result` once it ends. OpenCode's tools are given the names the chat
// knows them by (`bash` is `Bash`, `filePath` is `file_path`); one the chat
// does not know keeps its own name.
//
// What it costs OpenCode: one read of the session list and of the last few
// messages per check, a check at most every openCodeCheckEvery while its
// event stream says something changed and every openCodePollEvery while it
// says nothing, only while a browser is attached. The whole history is read
// once per attachment, and again only when the window no longer reaches what
// was already sent.
const (
	openCodeCheckEvery = 300 * time.Millisecond
	openCodePollEvery  = 2 * time.Second
	openCodeRetryEvery = time.Second
	openCodeWindow     = 20
)

// openCodeIDPattern is the shape of OpenCode's own ids (`ses_…`): anything
// else is never put in a path.
var openCodeIDPattern = regexp.MustCompile(`^[0-9A-Za-z_-]{1,128}$`)

// interruptedText is the line the chat reads as a turn the person stopped.
const interruptedText = "[Request interrupted by user]"

// followOpenCode follows the session's conversation through OpenCode's API
// until ctx ends. While OpenCode is not answering (starting, restarting) it
// is asked again every openCodeRetryEvery, and each new connection starts the
// history over.
func followOpenCode(ctx context.Context, server domain.AgentServer, entryMax, batchMax int, emit func(app.ChatBatch) error) {
	api := openCodeAPI{base: "http://127.0.0.1:" + strconv.Itoa(server.Port), server: server, http: &http.Client{}}
	// OpenCode names a conversation's directory as the process found it, its
	// links resolved.
	directory := server.Directory
	if directory != "" {
		directory = filepath.Clean(directory)
		if resolved, err := filepath.EvalSymlinks(directory); err == nil {
			directory = resolved
		}
	}
	for {
		f := newOpenCodeFollower(api, server.Since, directory, entryMax, batchMax, emit)
		_ = f.run(ctx)
		select {
		case <-ctx.Done():
			return
		case <-time.After(openCodeRetryEvery):
		}
	}
}

// The parts of OpenCode's API the chat reads, loosely: each part type uses a
// few of these fields.
type (
	openCodeSession struct {
		ID        string `json:"id"`
		ParentID  string `json:"parentID"`
		Directory string `json:"directory"`
		Time      struct {
			Updated int64 `json:"updated"`
		} `json:"time"`
	}
	openCodeMessage struct {
		Info  openCodeInfo   `json:"info"`
		Parts []openCodePart `json:"parts"`
	}
	openCodeInfo struct {
		ID   string `json:"id"`
		Role string `json:"role"`
		Time struct {
			Created   int64 `json:"created"`
			Completed int64 `json:"completed"`
		} `json:"time"`
		ModelID string `json:"modelID"`
		Tokens  *struct {
			Input  int64 `json:"input"`
			Output int64 `json:"output"`
			Cache  struct {
				Read  int64 `json:"read"`
				Write int64 `json:"write"`
			} `json:"cache"`
		} `json:"tokens"`
		Error *struct {
			Name string `json:"name"`
			Data struct {
				Message string `json:"message"`
			} `json:"data"`
		} `json:"error"`
	}
	openCodePart struct {
		ID        string        `json:"id"`
		Type      string        `json:"type"`
		Text      string        `json:"text"`
		Synthetic bool          `json:"synthetic"`
		Ignored   bool          `json:"ignored"`
		Time      *openCodeTime `json:"time"`
		CallID    string        `json:"callID"`
		Tool      string        `json:"tool"`
		State     *struct {
			Status string          `json:"status"`
			Input  json.RawMessage `json:"input"`
			Output string          `json:"output"`
			Error  string          `json:"error"`
			Time   *openCodeTime   `json:"time"`
		} `json:"state"`
		Mime string `json:"mime"`
	}
	openCodeTime struct {
		Start int64 `json:"start"`
		End   int64 `json:"end"`
	}
)

// How far a part has been sent: a part sent whole, or a tool call whose call
// went and whose result has not.
const (
	sentCall = 1
	sentAll  = 2
)

// openCodeFollower is one connection's read of the conversation.
type openCodeFollower struct {
	api       openCodeAPI
	since     int64
	directory string
	entryMax  int
	out       *follower

	session string
	// sent is how far each message and part has been sent.
	sent map[string]int
	// newest is the newest message id read, and full asks the next check for
	// the whole history rather than its last openCodeWindow messages.
	newest string
	full   bool
	// windowed is off once a window read did not reach the newest message
	// already read: an OpenCode that pages from the oldest, read whole.
	windowed bool
}

func newOpenCodeFollower(api openCodeAPI, since int64, directory string, entryMax, batchMax int, emit func(app.ChatBatch) error) *openCodeFollower {
	return &openCodeFollower{
		api: api, since: since, directory: directory, entryMax: entryMax,
		out:  &follower{entryMax: entryMax, batchMax: batchMax, emit: emit, reset: true},
		sent: map[string]int{}, windowed: true,
	}
}

// run checks the conversation when the event stream says it changed, and on
// a slower clock without it, until ctx ends or OpenCode stops answering.
func (f *openCodeFollower) run(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	changed := make(chan struct{}, 1)
	go func() {
		_ = f.api.events(ctx, func() {
			select {
			case changed <- struct{}{}:
			default:
			}
		})
	}()
	poll := time.NewTicker(openCodePollEvery)
	defer poll.Stop()
	for {
		if err := f.check(ctx); err != nil {
			return err
		}
		select {
		case <-ctx.Done():
			return nil
		case <-poll.C:
		case <-changed:
			// Several events in a burst are one read.
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(openCodeCheckEvery):
			}
		}
	}
}

// check reads what changed and sends it. An error is OpenCode not answering.
func (f *openCodeFollower) check(ctx context.Context) error {
	if len(f.out.pending) > 0 && !f.out.flush() {
		return nil
	}
	session, err := f.conversation(ctx)
	if err != nil {
		return err
	}
	if session != f.session {
		// Another conversation (the first, or `/new`): its history from the top.
		f.session, f.sent, f.newest, f.full = session, map[string]int{}, "", true
		f.out.pending, f.out.reset = nil, true
	}
	if session == "" {
		// Nothing said yet: say so once, so the view can wait for it.
		f.out.flush()
		return nil
	}
	messages, err := f.messages(ctx)
	if err != nil {
		return err
	}
	for _, message := range messages {
		f.read(message)
	}
	f.out.flush()
	return nil
}

// conversation is the session's conversation: the newest root one in its
// directory touched since the session launched, or "" while there is none.
// OpenCode is asked for the directory's alone, and each answer is checked
// against it too, for a version that lists the whole repository's.
func (f *openCodeFollower) conversation(ctx context.Context) (string, error) {
	query := url.Values{"roots": {"true"}}
	if f.directory != "" {
		query.Set("directory", f.directory)
	}
	var sessions []openCodeSession
	if err := f.api.get(ctx, "/session", query, &sessions); err != nil {
		return "", err
	}
	var newest openCodeSession
	for _, s := range sessions {
		if s.ParentID != "" || s.Time.Updated < f.since || !openCodeIDPattern.MatchString(s.ID) {
			continue
		}
		if f.directory != "" && s.Directory != "" && filepath.Clean(s.Directory) != f.directory {
			continue
		}
		if newest.ID == "" || s.Time.Updated > newest.Time.Updated {
			newest = s
		}
	}
	return newest.ID, nil
}

// messages is the conversation's messages, oldest first: its last few once
// the history is in, the whole of it when the last few do not reach back to
// what was already read.
func (f *openCodeFollower) messages(ctx context.Context) ([]openCodeMessage, error) {
	path := "/session/" + url.PathEscape(f.session) + "/message"
	if !f.full && f.windowed {
		var window []openCodeMessage
		if err := f.api.get(ctx, path, url.Values{"limit": {strconv.Itoa(openCodeWindow)}}, &window); err != nil {
			return nil, err
		}
		switch {
		case len(window) == 0:
		case window[len(window)-1].Info.ID < f.newest:
			f.windowed = false
		case len(window) < openCodeWindow || f.sent[window[0].Info.ID] > 0:
			f.note(window)
			return window, nil
		}
	}
	var all []openCodeMessage
	if err := f.api.get(ctx, path, nil, &all); err != nil {
		return nil, err
	}
	f.full = false
	f.note(all)
	return all, nil
}

func (f *openCodeFollower) note(messages []openCodeMessage) {
	if n := len(messages); n > 0 && messages[n-1].Info.ID > f.newest {
		f.newest = messages[n-1].Info.ID
	}
}

// read queues what in one message is finished and not yet sent.
func (f *openCodeFollower) read(message openCodeMessage) {
	switch message.Info.Role {
	case "user":
		f.readUser(message)
	case "assistant":
		f.readAssistant(message)
	}
}

func (f *openCodeFollower) readUser(message openCodeMessage) {
	info := message.Info
	if f.sent[info.ID] == sentAll || len(message.Parts) == 0 {
		return
	}
	f.sent[info.ID] = sentAll
	at := openCodeStamp(info.Time.Created)
	var blocks []chatBlock
	for _, part := range message.Parts {
		switch part.Type {
		case "text":
			if part.Synthetic || part.Ignored || part.Text == "" {
				continue
			}
			text, cut := truncate(part.Text, chatTextMax)
			blocks = append(blocks, chatBlock{Type: "text", Text: text, Truncated: cut})
		case "file":
			if len(part.Mime) > 6 && part.Mime[:6] == "image/" {
				blocks = append(blocks, chatBlock{Type: "image"})
			} else {
				blocks = append(blocks, chatBlock{Type: "document"})
			}
		case "compaction":
			f.add(chatEntry{
				Type: "user", UUID: part.ID, Timestamp: at, IsCompactSummary: true,
				Message: chatMessage{Role: "user", Content: "compacted"},
			})
		}
	}
	if len(blocks) > 0 {
		f.add(chatEntry{Type: "user", UUID: info.ID, Timestamp: at, Message: chatMessage{Role: "user", Content: blocks}})
	}
}

func (f *openCodeFollower) readAssistant(message openCodeMessage) {
	info := message.Info
	settled := info.Time.Completed != 0 || info.Error != nil
	var usage *chatUsage
	if t := info.Tokens; t != nil && t.Input+t.Cache.Read+t.Cache.Write > 0 {
		usage = &chatUsage{
			InputTokens: t.Input, CacheReadInputTokens: t.Cache.Read,
			CacheCreationInputTokens: t.Cache.Write, OutputTokens: t.Output,
		}
	}
	say := func(id string, at int64, block chatBlock) {
		if at == 0 {
			at = info.Time.Created
		}
		f.add(chatEntry{
			Type: "assistant", UUID: id, Timestamp: openCodeStamp(at),
			Message: chatMessage{ID: info.ID, Role: "assistant", Model: info.ModelID, Content: []chatBlock{block}, Usage: usage},
		})
	}
	for _, part := range message.Parts {
		if f.sent[part.ID] == sentAll {
			continue
		}
		start, ended := int64(0), settled
		if part.Time != nil {
			start, ended = part.Time.Start, ended || part.Time.End != 0
		}
		switch part.Type {
		case "text", "reasoning":
			if !ended || part.Synthetic || part.Ignored {
				continue
			}
			f.sent[part.ID] = sentAll
			if part.Text == "" {
				continue
			}
			if part.Type == "text" {
				text, cut := truncate(part.Text, chatTextMax)
				say(part.ID, start, chatBlock{Type: "text", Text: text, Truncated: cut})
			} else {
				text, cut := truncate(part.Text, chatThinkingMax)
				say(part.ID, start, chatBlock{Type: "thinking", Thinking: text, Truncated: cut})
			}
		case "tool":
			f.readTool(part, say)
		}
	}
	if info.Error != nil && f.sent["error:"+info.ID] == 0 {
		f.sent["error:"+info.ID] = sentAll
		at := openCodeStamp(info.Time.Completed)
		if info.Error.Name == "MessageAbortedError" {
			f.add(chatEntry{Type: "user", UUID: "error:" + info.ID, Timestamp: at, Message: chatMessage{Role: "user", Content: interruptedText}})
		} else {
			reason := info.Error.Data.Message
			if reason == "" {
				reason = info.Error.Name
			}
			text, _ := truncate("**"+info.Error.Name+"**: "+reason, chatTextMax)
			say("error:"+info.ID, info.Time.Completed, chatBlock{Type: "text", Text: text})
		}
	}
}

// readTool sends a call once it runs, as `tool_use`, and its result once it
// has ended, as `tool_result` on a user line, which is where the chat pairs
// them.
func (f *openCodeFollower) readTool(part openCodePart, say func(id string, at int64, block chatBlock)) {
	state := part.State
	if state == nil || state.Status == "pending" || part.CallID == "" {
		return
	}
	var start, end int64
	if state.Time != nil {
		start, end = state.Time.Start, state.Time.End
	}
	if f.sent[part.ID] < sentCall {
		var input any
		_ = json.Unmarshal(state.Input, &input)
		name, input := openCodeTool(part.Tool, input)
		input, cut := compactValue(input, chatToolInputMax)
		say(part.ID, start, chatBlock{Type: "tool_use", ID: part.CallID, Name: name, Input: input, Truncated: cut})
		f.sent[part.ID] = sentCall
	}
	if state.Status != "completed" && state.Status != "error" {
		return
	}
	f.sent[part.ID] = sentAll
	output, failed := state.Output, state.Status == "error"
	if failed {
		output = state.Error
	}
	text, cut := truncate(output, chatToolResultMax)
	f.add(chatEntry{
		Type: "user", UUID: part.ID + ":result", Timestamp: openCodeStamp(end),
		Message: chatMessage{Role: "user", Content: []chatBlock{{
			Type: "tool_result", ToolUseID: part.CallID, IsError: failed, Content: text, Truncated: cut,
		}}},
	})
}

// add queues one entry, leaving out one that does not fit in a frame.
func (f *openCodeFollower) add(entry chatEntry) {
	encoded, err := json.Marshal(entry)
	if err != nil || len(encoded) > f.entryMax {
		return
	}
	f.out.pending = append(f.out.pending, string(encoded))
}
