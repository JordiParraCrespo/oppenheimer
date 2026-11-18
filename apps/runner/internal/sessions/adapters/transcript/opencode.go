package transcript

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// OpenCode keeps its conversations in a database of its own, whose tables
// move between its versions, so the chat view reads them where OpenCode
// itself promises a shape: the API its TUI serves on a loopback port when it
// is launched with one (domain.AgentServer). The session's conversation is a
// root conversation OpenCode has for the session's directory, touched since
// the session first launched, so neither an older conversation in the same
// folder nor one in another worktree of the same repository (OpenCode keeps
// one store per repository) ever is. Of those, it is the one the session's
// own OpenCode process names on its event stream, which another OpenCode in
// the same folder (a second session started there, or one run by hand) never
// does, so `/new` in the TUI is followed and the other's conversation never
// is (openCodeFollower.conversation).
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
func followOpenCode(ctx context.Context, owners *openCodeOwners, server domain.AgentServer, entryMax, batchMax int, emit func(app.ChatBatch) error) {
	api := newOpenCodeAPI(server)
	directory := openCodeDirectory(server.Directory)
	for {
		f := newOpenCodeFollower(api, server.Since, directory, entryMax, batchMax, emit)
		f.owners, f.kept = owners, server.Conversation
		_ = f.run(ctx)
		select {
		case <-ctx.Done():
			return
		case <-time.After(openCodeRetryEvery):
		}
	}
}

func newOpenCodeAPI(server domain.AgentServer) openCodeAPI {
	return openCodeAPI{base: "http://127.0.0.1:" + strconv.Itoa(server.Port), server: server, http: &http.Client{}}
}

// openCodeDirectory is directory as OpenCode names a conversation's: as the
// process found it, its links resolved.
func openCodeDirectory(directory string) string {
	if directory == "" {
		return ""
	}
	directory = filepath.Clean(directory)
	if resolved, err := filepath.EvalSymlinks(directory); err == nil {
		directory = resolved
	}
	return directory
}

// openCodeRoots is the root conversations OpenCode has in directory touched
// since since. OpenCode is asked for the directory's alone, and each answer
// is checked against it too, for a version that lists the whole repository's.
func openCodeRoots(ctx context.Context, api openCodeAPI, since int64, directory string) ([]openCodeSession, error) {
	query := url.Values{"roots": {"true"}}
	if directory != "" {
		query.Set("directory", directory)
	}
	var sessions []openCodeSession
	if err := api.get(ctx, "/session", query, &sessions); err != nil {
		return nil, err
	}
	roots := sessions[:0]
	for _, s := range sessions {
		if s.ParentID != "" || s.Time.Updated < since || !openCodeIDPattern.MatchString(s.ID) {
			continue
		}
		if directory != "" && s.Directory != "" && filepath.Clean(s.Directory) != directory {
			continue
		}
		roots = append(roots, s)
	}
	return roots, nil
}

// newestOf is the id of the most recently touched of sessions that keep
// holds for, or "".
func newestOf(sessions []openCodeSession, keep func(openCodeSession) bool) string {
	var newest openCodeSession
	for _, s := range sessions {
		if keep(s) && (newest.ID == "" || s.Time.Updated > newest.Time.Updated) {
			newest = s
		}
	}
	return newest.ID
}

// openCodeOwners is the conversation each OpenCode process the runner
// launched was last heard working in, by its API's password, which is its
// launch's own. Each one's event stream is listened to from the first time
// the poll loop asks about it (ServedConversation) until it has not asked for
// openCodeWatchIdle: the session stopped, closed or was launched again under
// another password, whose process is listened to instead. So a session whose
// OpenCode sits idle when the chat is opened still shows its conversation,
// and another session's conversation in the same folder is never taken for
// its own.
type openCodeOwners struct {
	mu      sync.Mutex
	watches map[string]*openCodeWatch
	// idle is openCodeWatchIdle, shorter in tests.
	idle time.Duration
}

// openCodeWatch is one OpenCode process listened to.
type openCodeWatch struct {
	// conversation is the one it was last heard working in.
	conversation string
	// heard is what its event stream has named since the last resolve.
	heard map[string]bool
	asked time.Time
}

// openCodeWatchIdle is how long a process is listened to after the poll loop
// last asked about it: a few of its ticks.
const openCodeWatchIdle = time.Minute

func newOpenCodeOwners() *openCodeOwners {
	return &openCodeOwners{watches: map[string]*openCodeWatch{}, idle: openCodeWatchIdle}
}

// served is the conversation server's process was last heard working in,
// listening to it from now if nobody was. A process not heard from yet is
// taken to be in the one the session kept (server.Conversation).
func (o *openCodeOwners) served(ctx context.Context, server domain.AgentServer) string {
	o.mu.Lock()
	watch, ok := o.watches[server.Password]
	if !ok {
		watch = &openCodeWatch{conversation: server.Conversation, heard: map[string]bool{}}
		o.watches[server.Password] = watch
		go o.listen(server, watch)
	}
	watch.asked = time.Now()
	heard := watch.heard
	watch.heard = map[string]bool{}
	o.mu.Unlock()
	if len(heard) == 0 {
		return o.mine(server.Password)
	}
	api := newOpenCodeAPI(server)
	sessions, err := openCodeRoots(ctx, api, server.Since, openCodeDirectory(server.Directory))
	if err != nil {
		// Asked again on the next tick.
		o.mu.Lock()
		for id := range heard {
			watch.heard[id] = true
		}
		o.mu.Unlock()
		return o.mine(server.Password)
	}
	if named := newestOf(sessions, func(s openCodeSession) bool { return heard[s.ID] }); named != "" {
		o.claim(server.Password, named)
	}
	return o.mine(server.Password)
}

// listen reads server's event stream, reconnecting while OpenCode restarts,
// until nobody has asked about it for o.idle.
func (o *openCodeOwners) listen(server domain.AgentServer, watch *openCodeWatch) {
	api := newOpenCodeAPI(server)
	for {
		ctx, cancel := context.WithCancel(context.Background())
		go func() {
			_ = api.events(ctx, func(conversation string) {
				if conversation == "" {
					return
				}
				o.mu.Lock()
				watch.heard[conversation] = true
				o.mu.Unlock()
			})
			cancel()
		}()
		for alive := true; alive; {
			select {
			case <-ctx.Done():
				alive = false
			case <-time.After(o.idle / 4):
			}
			o.mu.Lock()
			stale := time.Since(watch.asked) > o.idle
			if stale {
				delete(o.watches, server.Password)
			}
			o.mu.Unlock()
			if stale {
				cancel()
				return
			}
		}
		cancel()
		time.Sleep(openCodeRetryEvery)
	}
}

// claim says server is working in conversation: no other server is anymore.
func (o *openCodeOwners) claim(server, conversation string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	for other, watch := range o.watches {
		if other != server && watch.conversation == conversation {
			watch.conversation = ""
		}
	}
	if watch, ok := o.watches[server]; ok {
		watch.conversation = conversation
	}
}

// mine is the conversation server was last heard working in, or "".
func (o *openCodeOwners) mine(server string) string {
	o.mu.Lock()
	defer o.mu.Unlock()
	if watch, ok := o.watches[server]; ok {
		return watch.conversation
	}
	return ""
}

// others reports whether a server other than server is working in
// conversation.
func (o *openCodeOwners) others(server, conversation string) bool {
	o.mu.Lock()
	defer o.mu.Unlock()
	for other, watch := range o.watches {
		if other != server && watch.conversation == conversation {
			return true
		}
	}
	return false
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
			// Metadata is what a tool says of itself: the `task` tool,
			// the conversation its subagent runs in.
			Metadata *struct {
				SessionID string `json:"sessionId"`
				Model     *struct {
					ModelID string `json:"modelID"`
				} `json:"model"`
			} `json:"metadata"`
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
	// owners is the runner's record of which OpenCode works in which
	// conversation; nil keeps none (a subagent's read). kept is the one the
	// session kept (domain.AgentServer.Conversation).
	owners *openCodeOwners
	kept   string

	// heardMu guards heard: the conversations this OpenCode's event stream
	// has named since the follower started.
	heardMu sync.Mutex
	heard   map[string]bool

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

	// agent is the subagent this follower reads for its parent, whose
	// entries it marks as the subagent's (SubagentEntryType); "" for the
	// session's own conversation.
	agent string
	// children are the subagents the conversation's `task` calls started,
	// by their conversation, and order the order they were met in.
	children map[string]*openCodeChild
	order    []string
}

// openCodeChild is one subagent a `task` call started: what its entry says,
// what was last sent of it, and its conversation's own read.
type openCodeChild struct {
	meta subagentMeta
	sent []byte
	read *openCodeFollower
	// done is a subagent that has ended and been read since, or whose
	// conversation OpenCode would not serve openCodeChildTries times.
	done bool
	// failed is how many reads of its conversation have failed in a row.
	failed int
}

// openCodeChildTries is how many times a subagent's conversation is asked
// for and refused before it is left: a conversation OpenCode deleted never
// comes back.
const openCodeChildTries = 5

func newOpenCodeFollower(api openCodeAPI, since int64, directory string, entryMax, batchMax int, emit func(app.ChatBatch) error) *openCodeFollower {
	return &openCodeFollower{
		api: api, since: since, directory: directory, entryMax: entryMax,
		out:  &follower{entryMax: entryMax, batchMax: batchMax, emit: emit, reset: true},
		sent: map[string]int{}, windowed: true, children: map[string]*openCodeChild{},
		heard: map[string]bool{},
	}
}

// run checks the conversation when the event stream says it changed, and on
// a slower clock without it, until ctx ends or OpenCode stops answering.
func (f *openCodeFollower) run(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	changed := make(chan struct{}, 1)
	go func() {
		_ = f.api.events(ctx, func(conversation string) {
			if conversation != "" {
				f.heardMu.Lock()
				f.heard[conversation] = true
				f.heardMu.Unlock()
			}
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
		f.children, f.order = map[string]*openCodeChild{}, nil
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
	if err := f.readChildren(ctx); err != nil {
		return err
	}
	f.out.flush()
	return nil
}

// readChildren reads each subagent's conversation while it runs, and once
// more after it has ended, sending its entry whenever what it says changed.
// The newest subagentsMax are followed.
func (f *openCodeFollower) readChildren(ctx context.Context) error {
	order := f.order
	if len(order) > subagentsMax {
		order = order[len(order)-subagentsMax:]
	}
	for _, id := range order {
		child := f.children[id]
		meta := child.meta
		meta.Type = SubagentEntryType
		if encoded, err := json.Marshal(meta); err == nil && !bytes.Equal(encoded, child.sent) && len(encoded) <= f.entryMax {
			f.out.pending = append(f.out.pending, string(encoded))
			child.sent = encoded
		}
		if child.done {
			continue
		}
		if child.read == nil {
			child.read = &openCodeFollower{
				api: f.api, entryMax: f.entryMax, out: f.out, session: id, agent: id,
				sent: map[string]int{}, full: true, windowed: true,
			}
		}
		messages, err := child.read.messages(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return err
			}
			// One subagent OpenCode will not serve never holds up the
			// session's own conversation.
			child.failed++
			child.done = child.failed >= openCodeChildTries
			continue
		}
		child.failed = 0
		for _, message := range messages {
			child.read.read(message)
		}
		child.done = meta.State != subagentRunning
	}
	return nil
}

// noteChild takes in what a `task` call says of the subagent it started.
func (f *openCodeFollower) noteChild(part openCodePart, input any) {
	state := part.State
	if part.Tool != "task" || state.Metadata == nil || !openCodeIDPattern.MatchString(state.Metadata.SessionID) {
		return
	}
	id := state.Metadata.SessionID
	child, ok := f.children[id]
	if !ok {
		child = &openCodeChild{}
		f.children[id] = child
		f.order = append(f.order, id)
	}
	fields, _ := input.(map[string]any)
	stringOf := func(key string) string {
		value, _ := fields[key].(string)
		return value
	}
	child.meta = subagentMeta{
		ID: id, ParentToolUseID: part.CallID,
		AgentType: stringOf("subagent_type"), Description: stringOf("description"),
		State: subagentRunning,
	}
	if model := state.Metadata.Model; model != nil {
		child.meta.Model = model.ModelID
	}
	switch state.Status {
	case "completed":
		child.meta.State = subagentCompleted
	case "error":
		child.meta.State = subagentFailed
	}
	if child.meta.State == subagentRunning {
		// Running again (a `task_id` resumed it): read it again.
		child.done = false
	}
}

// conversation is the session's conversation, or "" while there is none. Of
// the root conversations in its directory touched since the session
// launched, it is, in order:
//
//  1. the newest one this follower has heard its OpenCode name: the TUI is
//     working in it, or `/new` just made it;
//  2. the one its OpenCode was last heard working in, by the runner
//     (openCodeOwners), or else the one the session kept from that;
//  3. the one already shown, while no other OpenCode works in it;
//  4. the newest one no other OpenCode works in.
//
// So the conversation of another OpenCode in the same folder, newer as it
// may be, never replaces the session's own once that is known.
func (f *openCodeFollower) conversation(ctx context.Context) (string, error) {
	sessions, err := openCodeRoots(ctx, f.api, f.since, f.directory)
	if err != nil {
		return "", err
	}
	f.heardMu.Lock()
	heard := make(map[string]bool, len(f.heard))
	for id := range f.heard {
		heard[id] = true
	}
	f.heardMu.Unlock()
	server := f.api.server.Password
	mine, others := "", func(string) bool { return false }
	if f.owners != nil {
		mine = f.owners.mine(server)
		others = func(id string) bool { return f.owners.others(server, id) }
	}
	listed := func(id string) bool {
		return id != "" && newestOf(sessions, func(s openCodeSession) bool { return s.ID == id }) != ""
	}
	if named := newestOf(sessions, func(s openCodeSession) bool { return heard[s.ID] }); named != "" {
		if f.owners != nil {
			f.owners.claim(server, named)
		}
		return named, nil
	}
	switch {
	case listed(mine):
		return mine, nil
	case listed(f.kept):
		return f.kept, nil
	case listed(f.session) && !others(f.session):
		return f.session, nil
	}
	return newestOf(sessions, func(s openCodeSession) bool { return !others(s.ID) }), nil
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
	if f.agent == "" {
		var raw any
		_ = json.Unmarshal(state.Input, &raw)
		f.noteChild(part, raw)
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
	if f.agent != "" {
		entry.IsSidechain, entry.AgentID = true, f.agent
	}
	encoded, err := json.Marshal(entry)
	if err != nil || len(encoded) > f.entryMax {
		return
	}
	f.out.pending = append(f.out.pending, string(encoded))
}
