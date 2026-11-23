package transcript

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	// The SQLite driver, for the database Hermes keeps (read only).
	_ "modernc.org/sqlite"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// Hermes keeps every conversation in one SQLite database, `state.db` in its
// home: a `sessions` row per conversation, which a CLI conversation stamps
// with the directory it was started in (`cwd`) and when (`started_at`, Unix
// seconds), and a `messages` row per message in OpenAI's chat shape (a
// role, its text, the assistant's `tool_calls` and a tool's reply by
// `tool_call_id`, and the model's `reasoning`). Read off hermes-agent's own
// schema (`persistence/sqlite/_schema_ddl.py`), opened read only.
//
// A session's conversation is the newest CLI conversation Hermes started in
// the session's directory since the session was created: a worktree is the
// session's own and never reused, so it is this session's and no other's.
// Hermes names it itself, and `--continue` reopens it, so it is found the same
// way after a restart. When Hermes compacts a long conversation it ends that
// row with `compression` and carries on in a child row, so the chat reads the
// chain back to its first row, and leaves out what a child copied of its
// parent's last turn.
//
// What the chat shows is what Hermes shows: the rows that are live or were
// archived by a compaction (`active = 1 OR compacted = 1`), never a turn the
// person undid. An undo, a rewrite in place (Hermes counts those in the
// row's `transcript_revision`) or a new conversation starts the chat's
// history over.
//
// What it costs Hermes: two small reads every hermesCheckEvery, only while a
// browser is attached; the whole conversation is read once per attachment.
const (
	hermesCheckEvery = 700 * time.Millisecond
	// hermesSince is how much earlier than the session's creation a
	// conversation may say it started: the two clocks are the same machine's,
	// but Hermes stamps the row from its own process.
	hermesSince = 5 * time.Second
	// hermesChain bounds the compaction chain walked back, as Hermes' own
	// reader does.
	hermesChain = 100
)

// hermesCLISources are the `source` a conversation started from Hermes' CLI
// records (`CLI_FAMILY_SOURCES`): a subagent's or a gateway's never is the
// session's, even where it inherits the directory.
var hermesCLISources = []string{"cli", "oneshot"}

// hermesSource is Hermes' database.
type hermesSource struct {
	db string
}

// hermesMessage is one row of Hermes' `messages`, as the chat reads it.
type hermesMessage struct {
	id         int64
	session    string
	role       string
	content    string
	toolCalls  string
	toolCallID string
	toolName   string
	reasoning  string
	at         float64
}

// hermesConversation is where a session's conversation stands: its rows,
// first to last, and what moves when one of them is rewritten or undone.
type hermesConversation struct {
	ids []string
	// revision is the sum of the rows' `transcript_revision`, which Hermes
	// bumps on a rewrite in place.
	revision int64
}

// open opens the database read only, or nil while there is none yet.
func (h hermesSource) open() (*sql.DB, error) {
	if h.db == "" {
		return nil, nil
	}
	if _, err := os.Stat(h.db); errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	dsn := (&url.URL{Scheme: "file", Path: h.db, RawQuery: "mode=ro&_pragma=busy_timeout(2000)&_pragma=query_only(1)"}).String()
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	return db, nil
}

// conversation finds the session's conversation, or none yet: Hermes writes
// its row with the first message.
func (h hermesSource) conversation(ctx context.Context, db *sql.DB, session domain.Session) (hermesConversation, error) {
	cwd := session.Cwd()
	if cwd == "" {
		return hermesConversation{}, nil
	}
	dirs := make([]any, 0, 2)
	for dir := range sameDirectory(cwd) {
		dirs = append(dirs, dir)
	}
	args := append(dirs, float64(session.Created.Add(-hermesSince).UnixMilli())/1000)
	for _, source := range hermesCLISources {
		args = append(args, source)
	}
	var tip string
	err := db.QueryRowContext(ctx,
		`SELECT id FROM sessions WHERE cwd IN (`+marks(len(dirs))+`) AND started_at >= ?
		 AND source IN (`+marks(len(hermesCLISources))+`) ORDER BY started_at DESC, id DESC LIMIT 1`,
		args...).Scan(&tip)
	if errors.Is(err, sql.ErrNoRows) {
		return hermesConversation{}, nil
	}
	if err != nil {
		return hermesConversation{}, err
	}
	// Back along the compaction chain to its first row.
	ids := []string{tip}
	seen := map[string]bool{tip: true}
	for current := tip; len(ids) < hermesChain; {
		var parent sql.NullString
		var reason sql.NullString
		err := db.QueryRowContext(ctx,
			`SELECT p.id, p.end_reason FROM sessions c JOIN sessions p ON p.id = c.parent_session_id WHERE c.id = ?`,
			current).Scan(&parent, &reason)
		if errors.Is(err, sql.ErrNoRows) {
			break
		}
		if err != nil {
			return hermesConversation{}, err
		}
		if !parent.Valid || reason.String != "compression" || seen[parent.String] {
			break
		}
		seen[parent.String] = true
		ids = append([]string{parent.String}, ids...)
		current = parent.String
	}
	conversation := hermesConversation{ids: ids}
	err = db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(transcript_revision), 0) FROM sessions WHERE id IN (`+marks(len(ids))+`)`,
		anys(ids)...).Scan(&conversation.revision)
	return conversation, err
}

// messages are the conversation's rows the chat shows with an id past after,
// first to last.
func (h hermesSource) messages(ctx context.Context, db *sql.DB, ids []string, after int64) ([]hermesMessage, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, session_id, role, COALESCE(content, ''), COALESCE(tool_calls, ''), COALESCE(tool_call_id, ''),
		        COALESCE(tool_name, ''), COALESCE(reasoning, ''), timestamp
		 FROM messages WHERE session_id IN (`+marks(len(ids))+`) AND (active = 1 OR compacted = 1) AND id > ?
		 ORDER BY id`,
		append(anys(ids), after)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []hermesMessage
	for rows.Next() {
		var m hermesMessage
		if err := rows.Scan(&m.id, &m.session, &m.role, &m.content, &m.toolCalls, &m.toolCallID, &m.toolName, &m.reasoning, &m.at); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// shown counts the conversation's rows the chat shows up to id through, which
// moves when one already sent is undone.
func (h hermesSource) shown(ctx context.Context, db *sql.DB, ids []string, through int64) (int, error) {
	var n int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM messages WHERE session_id IN (`+marks(len(ids))+`) AND (active = 1 OR compacted = 1) AND id <= ?`,
		append(anys(ids), through)...).Scan(&n)
	return n, err
}

// followHermes follows the session's conversation until ctx ends.
func followHermes(ctx context.Context, source hermesSource, session domain.Session, entryMax, batchMax int, emit func(app.ChatBatch) error) {
	f := &hermesFollower{
		source: source, session: session, entryMax: entryMax,
		out: &follower{entryMax: entryMax, batchMax: batchMax, emit: emit, reset: true},
	}
	defer f.close()
	ticker := time.NewTicker(hermesCheckEvery)
	defer ticker.Stop()
	for {
		f.check(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// hermesFollower is one attachment's read of the conversation.
type hermesFollower struct {
	source   hermesSource
	session  domain.Session
	entryMax int
	out      *follower
	db       *sql.DB

	// conversation is the one sent, and sent how far: the last row's id, and
	// how many rows up to it the chat shows.
	conversation hermesConversation
	last         int64
	count        int
	chat         *hermesChat
}

func (f *hermesFollower) close() {
	if f.db != nil {
		_ = f.db.Close()
	}
}

// check reads what changed and sends it. A database that cannot be read is
// asked again on the next check.
func (f *hermesFollower) check(ctx context.Context) {
	if len(f.out.pending) > 0 && !f.out.flush() {
		return
	}
	if f.db == nil {
		db, err := f.source.open()
		if err != nil || db == nil {
			f.out.flush()
			return
		}
		f.db = db
	}
	conversation, err := f.source.conversation(ctx, f.db, f.session)
	if err != nil {
		return
	}
	if !f.continues(ctx, conversation) {
		// Another conversation, or this one rewritten: its history from the top.
		f.last, f.count, f.chat = 0, 0, newHermesChat()
		f.out.pending, f.out.reset = nil, true
		// The whole history is read below, at once: its last batch says so.
		f.out.history = historyRead
	}
	f.conversation = conversation
	if len(conversation.ids) > 0 {
		messages, err := f.source.messages(ctx, f.db, conversation.ids, f.last)
		if err != nil {
			return
		}
		for _, message := range messages {
			for _, entry := range f.chat.entries(message, f.entryMax) {
				f.out.pending = append(f.out.pending, string(entry))
			}
			f.last = message.id
			f.count++
		}
	}
	f.out.flush()
}

// continues is whether conversation is the one sent so far, grown at most: the
// same chain or one a compaction carried on, nothing rewritten in place, and
// none of what was sent undone.
func (f *hermesFollower) continues(ctx context.Context, conversation hermesConversation) bool {
	if f.chat == nil {
		return false
	}
	sent := f.conversation.ids
	if len(conversation.ids) < len(sent) {
		return false
	}
	for i, id := range sent {
		if conversation.ids[i] != id {
			return false
		}
	}
	if len(sent) == 0 {
		return len(conversation.ids) == 0
	}
	if len(conversation.ids) == len(sent) && conversation.revision != f.conversation.revision {
		return false
	}
	shown, err := f.source.shown(ctx, f.db, conversation.ids, f.last)
	return err == nil && shown == f.count
}

// readHermesPage is a page of the conversation for a reader with no browser
// attached (ReadPage): the entries of the rows after req.After, a row id.
func readHermesPage(source hermesSource, session domain.Session, req app.TranscriptPageRequest) (app.TranscriptPage, error) {
	page := app.TranscriptPage{Entries: []string{}, AtEnd: true}
	db, err := source.open()
	if err != nil || db == nil {
		return page, err
	}
	defer db.Close()
	ctx := context.Background()
	conversation, err := source.conversation(ctx, db, session)
	if err != nil || len(conversation.ids) == 0 {
		return page, err
	}
	page.Conversation = conversation.ids[0]
	after := req.After
	if req.Conversation != page.Conversation || after < 0 {
		page.Restarted, after = req.Conversation != "" || after != 0, 0
	}
	// The chat's entries depend on the rows before them (a tool's reply
	// pairs with its call), so the rows before the page are read too.
	messages, err := source.messages(ctx, db, conversation.ids, 0)
	if err != nil {
		return app.TranscriptPage{}, err
	}
	chat := newHermesChat()
	page.From, page.Next = after, after
	bytes := 0
	for _, message := range messages {
		entries := chat.entries(message, req.EntryMax)
		if message.id <= after {
			continue
		}
		size := 0
		for _, entry := range entries {
			size += len(entry)
		}
		if (req.Limit > 0 && len(page.Entries)+len(entries) > req.Limit) || (req.BytesMax > 0 && bytes+size > req.BytesMax) {
			page.AtEnd = false
			break
		}
		for _, entry := range entries {
			page.Entries = append(page.Entries, string(entry))
		}
		bytes += size
		page.Next = message.id
	}
	return page, nil
}

// hermesChat turns Hermes' rows into the chat's entries (`claude_chat.go`'s
// shape), remembering what it needs from one row to the next.
type hermesChat struct {
	// seen are the user's messages already shown, by when and what, so the
	// turn a compaction copies into its child row is shown once.
	seen map[string]bool
	// names are the tools of the calls made, by call id, for their replies.
	names map[string]string
}

func newHermesChat() *hermesChat {
	return &hermesChat{seen: map[string]bool{}, names: map[string]string{}}
}

func (c *hermesChat) entries(m hermesMessage, max int) [][]byte {
	id := "hermes:" + strconv.FormatInt(m.id, 10)
	at := hermesStamp(m.at)
	var out [][]byte
	switch m.role {
	case "user":
		text := hermesText(m.content)
		key := strconv.FormatFloat(m.at, 'f', -1, 64) + "\x00" + text
		if strings.TrimSpace(text) == "" || c.seen[key] {
			return nil
		}
		c.seen[key] = true
		clipped, cut := truncate(text, chatTextMax)
		out = userEntry(id, at, []chatBlock{{Type: "text", Text: clipped, Truncated: cut}})
	case "assistant":
		var blocks []chatBlock
		if strings.TrimSpace(m.reasoning) != "" {
			thought, _ := truncate(m.reasoning, chatTextMax)
			blocks = append(blocks, chatBlock{Type: "thinking", Thinking: thought})
		}
		if text := hermesText(m.content); strings.TrimSpace(text) != "" {
			clipped, cut := truncate(text, chatTextMax)
			blocks = append(blocks, chatBlock{Type: "text", Text: clipped, Truncated: cut})
		}
		blocks = append(blocks, c.calls(m)...)
		if len(blocks) == 0 {
			return nil
		}
		out = encode(chatEntry{Type: "assistant", UUID: id, Timestamp: at, Message: chatMessage{Role: "assistant", Content: blocks}})
	case "tool":
		callID := m.toolCallID
		if callID == "" {
			return nil
		}
		text := hermesText(m.content)
		content, cut := truncate(hermesOutput(text), chatToolResultMax)
		out = userEntry(id, at, []chatBlock{{
			Type: "tool_result", ToolUseID: callID, IsError: hermesFailed(text), Content: content, Truncated: cut,
		}})
	}
	kept := out[:0]
	for _, entry := range out {
		if max <= 0 || len(entry) <= max {
			kept = append(kept, entry)
		}
	}
	return kept
}

// calls are an assistant row's tool calls as `tool_use` blocks.
func (c *hermesChat) calls(m hermesMessage) []chatBlock {
	if m.toolCalls == "" {
		return nil
	}
	var calls []struct {
		ID       string `json:"id"`
		Function struct {
			Name      string `json:"name"`
			Arguments string `json:"arguments"`
		} `json:"function"`
	}
	if json.Unmarshal([]byte(m.toolCalls), &calls) != nil {
		return nil
	}
	var blocks []chatBlock
	for _, call := range calls {
		args := map[string]any{}
		if call.Function.Arguments != "" {
			_ = json.Unmarshal([]byte(call.Function.Arguments), &args)
		}
		c.names[call.ID] = call.Function.Name
		for n, use := range hermesTool(call.Function.Name, args) {
			useID := call.ID
			if n > 0 {
				useID = call.ID + "#" + strconv.Itoa(n+1)
			}
			input, cut := compactValue(use.input, chatToolInputMax)
			blocks = append(blocks, chatBlock{Type: "tool_use", ID: useID, Name: use.name, Input: input, Truncated: cut})
		}
	}
	return blocks
}

// hermesTool is a Hermes call as the chat knows it: its commands as `Bash`,
// its file reads, writes and replacements as `Read`, `Write` and `Edit`, a
// patch as an `Edit` per file (Codex's format, which Hermes' `patch` takes
// in its `patch` mode), its search as `Grep` and its task list as
// `TodoWrite`. Any other call keeps its name and its arguments. Read off
// hermes-agent's tool schemas (`tools/`).
func hermesTool(name string, args map[string]any) []codexUse {
	switch name {
	case "terminal":
		return []codexUse{{"Bash", map[string]any{"command": args["command"]}}}
	case "read_file":
		input := map[string]any{"file_path": args["path"]}
		for _, key := range []string{"offset", "limit"} {
			if value, ok := args[key]; ok {
				input[key] = value
			}
		}
		return []codexUse{{"Read", input}}
	case "write_file":
		return []codexUse{{"Write", map[string]any{"file_path": args["path"], "content": args["content"]}}}
	case "patch":
		if patch, _ := args["patch"].(string); patch != "" {
			if files := codexPatch(patch); len(files) > 0 {
				return files
			}
		}
		return []codexUse{{"Edit", map[string]any{
			"file_path": args["path"], "old_string": args["old_string"], "new_string": args["new_string"],
			"replace_all": args["replace_all"],
		}}}
	case "search_files":
		return []codexUse{{"Grep", map[string]any{"pattern": args["pattern"], "path": args["path"], "glob": args["file_glob"]}}}
	case "todo", "todo_list":
		return []codexUse{{"TodoWrite", map[string]any{"todos": args["todos"]}}}
	case "web_search":
		return []codexUse{{"WebSearch", map[string]any{"query": args["query"]}}}
	}
	return []codexUse{{name, args}}
}

// hermesText is a row's content as text: Hermes keeps a message with images
// as a JSON list of OpenAI's parts, whose text parts are its words.
func hermesText(content string) string {
	trimmed := strings.TrimSpace(content)
	if !strings.HasPrefix(trimmed, "[") {
		return content
	}
	var parts []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal([]byte(trimmed), &parts) != nil {
		return content
	}
	texts := make([]string, 0, len(parts))
	for _, part := range parts {
		if part.Type == "text" && part.Text != "" {
			texts = append(texts, part.Text)
		}
	}
	return strings.Join(texts, "\n")
}

// hermesFailed is a tool's reply that says it failed: Hermes' tools answer
// JSON, with an `error` when they did not do what they were asked, and its
// terminal with the command's `exit_code`.
func hermesFailed(text string) bool {
	var reply struct {
		Error    any   `json:"error"`
		Success  *bool `json:"success"`
		ExitCode *int  `json:"exit_code"`
	}
	if json.Unmarshal([]byte(strings.TrimSpace(text)), &reply) != nil {
		return false
	}
	if (reply.Success != nil && !*reply.Success) || (reply.ExitCode != nil && *reply.ExitCode != 0) {
		return true
	}
	switch e := reply.Error.(type) {
	case nil:
		return false
	case string:
		return e != ""
	default:
		return true
	}
}

// hermesOutput is a tool's reply as the chat shows a result: its terminal's
// `output` and `error` as text, a command's output as a person would read it;
// any other reply as it came.
func hermesOutput(text string) string {
	var reply struct {
		Output *string `json:"output"`
		Error  string  `json:"error"`
	}
	if json.Unmarshal([]byte(strings.TrimSpace(text)), &reply) != nil || reply.Output == nil {
		return text
	}
	return strings.TrimSpace(strings.Join([]string{*reply.Output, reply.Error}, "\n"))
}

// hermesStamp is a time Hermes keeps in Unix seconds as the chat reads one.
func hermesStamp(seconds float64) string {
	if seconds <= 0 {
		return ""
	}
	return time.UnixMilli(int64(seconds * 1000)).UTC().Format(time.RFC3339Nano)
}

// marks is n SQL placeholders.
func marks(n int) string {
	return strings.TrimSuffix(strings.Repeat("?, ", n), ", ")
}

func anys(values []string) []any {
	out := make([]any, len(values))
	for i, value := range values {
		out[i] = value
	}
	return out
}
