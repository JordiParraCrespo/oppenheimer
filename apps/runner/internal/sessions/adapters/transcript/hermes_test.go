package transcript_test

import (
	"database/sql"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// hermesSchema is the part of Hermes' `state.db` the reader reads, as
// hermes-agent's `persistence/sqlite/_schema_ddl.py` declares it.
const hermesSchema = `
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    parent_session_id TEXT,
    started_at REAL NOT NULL,
    ended_at REAL,
    end_reason TEXT,
    cwd TEXT,
    transcript_revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL,
    content TEXT,
    tool_call_id TEXT,
    tool_calls TEXT,
    tool_name TEXT,
    timestamp REAL NOT NULL,
    reasoning TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    compacted INTEGER NOT NULL DEFAULT 0
);`

// hermesHome is a Hermes home with its database, in WAL mode as Hermes
// keeps it, and a writer standing in for Hermes.
func hermesHome(t *testing.T) (string, *sql.DB) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "state.db")
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=journal_mode(WAL)")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.Exec(hermesSchema); err != nil {
		t.Fatal(err)
	}
	return path, db
}

func exec(t *testing.T, db *sql.DB, query string, args ...any) {
	t.Helper()
	if _, err := db.Exec(query, args...); err != nil {
		t.Fatal(err)
	}
}

func hermesSession(t *testing.T, db *sql.DB, id, source, cwd string, started time.Time) {
	t.Helper()
	exec(t, db, `INSERT INTO sessions (id, source, cwd, started_at) VALUES (?, ?, ?, ?)`,
		id, source, cwd, float64(started.UnixMilli())/1000)
}

func hermesRow(t *testing.T, db *sql.DB, session, role, content string, extra map[string]any) {
	t.Helper()
	var calls, callID, reasoning any
	if v, ok := extra["tool_calls"]; ok {
		encoded, _ := json.Marshal(v)
		calls = string(encoded)
	}
	callID, reasoning = extra["tool_call_id"], extra["reasoning"]
	exec(t, db, `INSERT INTO messages (session_id, role, content, tool_calls, tool_call_id, reasoning, timestamp)
		VALUES (?, ?, ?, ?, ?, ?, ?)`, session, role, content, calls, callID, reasoning, float64(time.Now().UnixMilli())/1000)
}

func hermesCall(id, name string, args map[string]any) map[string]any {
	encoded, _ := json.Marshal(args)
	return map[string]any{"id": id, "type": "function", "function": map[string]any{"name": name, "arguments": string(encoded)}}
}

// A Hermes session's conversation, rows in Hermes' database rather than a
// file, reaches the chat as the transcript it already draws: the prompt, a
// thought, a command as Bash and its output, a replacement as an Edit, the
// reply, and the end of the history. It is the CLI conversation started in
// the session's worktree since the session was created; an older one there,
// a subagent's that inherited the folder and another worktree's are not.
// Regression: an empty Chat tab on a Hermes session.
func TestAHermesSessionsConversationReadsAsTheChat(t *testing.T) {
	path, db := hermesHome(t)
	worktree := t.TempDir()
	created := time.Now().Add(-time.Minute)
	hermesSession(t, db, "old", "cli", worktree, created.Add(-time.Hour))
	hermesRow(t, db, "old", "user", "an earlier conversation", nil)
	hermesSession(t, db, "20261123_x", "cli", worktree, created.Add(time.Second))
	hermesRow(t, db, "20261123_x", "user", "Fix the wallet test", nil)
	hermesRow(t, db, "20261123_x", "assistant", "", map[string]any{
		"reasoning":  "Run it first.",
		"tool_calls": []any{hermesCall("c1", "terminal", map[string]any{"command": "pnpm test wallet"})},
	})
	hermesRow(t, db, "20261123_x", "tool", `{"output": "1 failed", "exit_code": 1}`, map[string]any{"tool_call_id": "c1"})
	hermesRow(t, db, "20261123_x", "assistant", "", map[string]any{
		"tool_calls": []any{hermesCall("c2", "patch", map[string]any{
			"path": "src/wallet.ts", "old_string": "reduce(add)", "new_string": "reduce(add, 0)",
		})},
	})
	hermesRow(t, db, "20261123_x", "tool", `{"success": true}`, map[string]any{"tool_call_id": "c2"})
	hermesRow(t, db, "20261123_x", "assistant", "Fixed: it had no initial value.", nil)
	hermesSession(t, db, "sub", "subagent", worktree, created.Add(2*time.Second))
	hermesRow(t, db, "sub", "user", "a subagent's task", nil)
	hermesSession(t, db, "elsewhere", "cli", t.TempDir(), created.Add(3*time.Second))
	hermesRow(t, db, "elsewhere", "user", "another worktree", nil)

	sink := &batches{}
	followSession(t, transcript.Options{HermesState: path},
		domain.Session{Agent: domain.AgentHermes, Worktree: worktree, Created: created}, sink)

	eventually(t, "the conversation", func() bool { return len(sink.entries()) == 6 })
	got := sink.entries()
	if block := blockOf(got[0]); got[0]["type"] != "user" || block["text"] != "Fix the wallet test" {
		t.Fatalf("first entry = %v, want the prompt", got[0])
	}
	if block := blockOf(got[1]); block["type"] != "thinking" || block["thinking"] != "Run it first." {
		t.Fatalf("second entry = %v, want the thought first", got[1])
	}
	blocks := got[1]["message"].(map[string]any)["content"].([]any)
	bash := blocks[1].(map[string]any)
	if input, _ := bash["input"].(map[string]any); bash["name"] != "Bash" || input["command"] != "pnpm test wallet" {
		t.Fatalf("second entry's call = %v, want the command as Bash", bash)
	}
	if result := blockOf(got[2]); result["tool_use_id"] != "c1" || result["content"] != "1 failed" ||
		result["is_error"] != true {
		t.Fatalf("third entry = %v, want the command's output, failed by its exit code", got[2])
	}
	edit := blockOf(got[3])
	if input, _ := edit["input"].(map[string]any); edit["name"] != "Edit" || input["file_path"] != "src/wallet.ts" ||
		input["old_string"] != "reduce(add)" || input["new_string"] != "reduce(add, 0)" {
		t.Fatalf("fourth entry = %v, want the replacement as an Edit", got[3])
	}
	if result := blockOf(got[4]); result["tool_use_id"] != "c2" || result["is_error"] == true {
		t.Fatalf("fifth entry = %v, want the edit's result, not failed", got[4])
	}
	if reply := blockOf(got[5]); reply["text"] != "Fixed: it had no initial value." {
		t.Fatalf("sixth entry = %v, want the reply", got[5])
	}
	time.Sleep(1500 * time.Millisecond)
	if n := len(sink.entries()); n != 6 {
		t.Fatalf("%d entries, want the six of this session's conversation and nothing else", n)
	}
	if !historyEnded(sink) {
		t.Fatal("the history never said it ended")
	}
}

func historyEnded(sink *batches) bool {
	sink.mu.Lock()
	defer sink.mu.Unlock()
	for _, batch := range sink.got {
		if batch.History == app.HistoryEnd {
			return true
		}
	}
	return false
}

func resets(sink *batches) int {
	sink.mu.Lock()
	defer sink.mu.Unlock()
	n := 0
	for _, batch := range sink.got {
		if batch.Reset {
			n++
		}
	}
	return n
}

// What Hermes writes while the chat is open arrives as it is written, after
// the history and without starting it over; a turn the person undoes (Hermes
// keeps the row, inactive) starts the history over without it. Before the
// first message there is no conversation at all, which the chat shows as an
// empty history. Regression: a chat frozen on what was there when it opened,
// or one still showing an undone turn.
func TestAHermesChatFollowsNewRowsAndStartsOverOnAnUndo(t *testing.T) {
	path, db := hermesHome(t)
	worktree := t.TempDir()
	created := time.Now().Add(-time.Minute)
	sink := &batches{}
	followSession(t, transcript.Options{HermesState: path},
		domain.Session{Agent: domain.AgentHermes, Worktree: worktree, Created: created}, sink)
	eventually(t, "an empty history", func() bool { return historyEnded(sink) })

	hermesSession(t, db, "s1", "cli", worktree, time.Now())
	hermesRow(t, db, "s1", "user", "What is in README.md?", nil)
	eventually(t, "the prompt", func() bool { return len(sink.entries()) == 1 })
	hermesRow(t, db, "s1", "assistant", "A title and an install line.", nil)
	eventually(t, "the reply", func() bool { return len(sink.entries()) == 2 })
	before := resets(sink)

	exec(t, db, `UPDATE messages SET active = 0 WHERE role = 'assistant'`)
	eventually(t, "the undo", func() bool { return resets(sink) > before && len(sink.entries()) == 1 })
	if text := blockOf(sink.entries()[0])["text"]; text != "What is in README.md?" {
		t.Fatalf("after the undo the chat shows %v, want the prompt alone", text)
	}
}

// A conversation Hermes compacted carries on in a child row, and the chat
// reads it from its first row on, with the turn the child copied of its
// parent shown once; the compacted rows stay, as Hermes shows them. Regression:
// a chat that lost everything before a compaction, or showed a prompt twice.
func TestAHermesChatReadsACompactedConversationWhole(t *testing.T) {
	path, db := hermesHome(t)
	worktree := t.TempDir()
	created := time.Now().Add(-time.Minute)
	started := time.Now()
	hermesSession(t, db, "root", "cli", worktree, started)
	exec(t, db, `INSERT INTO messages (session_id, role, content, timestamp, active, compacted) VALUES ('root', 'user', 'Port the API', ?, 0, 1)`,
		float64(started.UnixMilli())/1000)
	exec(t, db, `INSERT INTO messages (session_id, role, content, timestamp) VALUES ('root', 'user', 'Now the tests', ?)`,
		float64(started.Add(time.Second).UnixMilli())/1000)
	exec(t, db, `UPDATE sessions SET ended_at = ?, end_reason = 'compression' WHERE id = 'root'`, float64(time.Now().Unix()))
	exec(t, db, `INSERT INTO sessions (id, source, cwd, started_at, parent_session_id) VALUES ('tip', 'cli', ?, ?, 'root')`,
		worktree, float64(started.Add(2*time.Second).UnixMilli())/1000)
	exec(t, db, `INSERT INTO messages (session_id, role, content, timestamp) VALUES ('tip', 'user', 'Now the tests', ?)`,
		float64(started.Add(time.Second).UnixMilli())/1000)
	hermesRow(t, db, "tip", "assistant", "Tests pass.", nil)

	sink := &batches{}
	followSession(t, transcript.Options{HermesState: path},
		domain.Session{Agent: domain.AgentHermes, Worktree: worktree, Created: created}, sink)
	eventually(t, "the conversation", func() bool { return len(sink.entries()) == 3 })
	got := sink.entries()
	for i, want := range []string{"Port the API", "Now the tests", "Tests pass."} {
		if text := blockOf(got[i])["text"]; text != want {
			t.Fatalf("entry %d = %v, want %q", i, text, want)
		}
	}
}

// A reader with no browser attached (a bot, `opp`) reads the conversation a
// page at a time, each page's cursor where the next one starts, and a cursor
// from another conversation reads from the start. Regression: a bot told a
// Hermes session has no conversation.
func TestAHermesConversationReadsAPageAtATime(t *testing.T) {
	path, db := hermesHome(t)
	worktree := t.TempDir()
	created := time.Now().Add(-time.Minute)
	hermesSession(t, db, "s1", "cli", worktree, time.Now())
	for _, text := range []string{"one", "two", "three"} {
		hermesRow(t, db, "s1", "user", text, nil)
	}
	session := domain.Session{Agent: domain.AgentHermes, Worktree: worktree, Created: created}
	reader := transcript.New(transcript.Options{HermesState: path})

	first, err := reader.ReadPage(session, app.TranscriptPageRequest{Limit: 2})
	if err != nil || len(first.Entries) != 2 || first.AtEnd || first.Conversation == "" {
		t.Fatalf("first page = %+v, %v; want two entries and more to come", first, err)
	}
	rest, err := reader.ReadPage(session, app.TranscriptPageRequest{Conversation: first.Conversation, After: first.Next, Limit: 2})
	if err != nil || len(rest.Entries) != 1 || !rest.AtEnd || rest.Restarted {
		t.Fatalf("second page = %+v, %v; want the last entry", rest, err)
	}
	var entry map[string]any
	_ = json.Unmarshal([]byte(rest.Entries[0]), &entry)
	if text := blockOf(entry)["text"]; text != "three" {
		t.Fatalf("second page holds %v, want the third message", text)
	}
	stale, err := reader.ReadPage(session, app.TranscriptPageRequest{Conversation: "another", After: 2, Limit: 5})
	if err != nil || !stale.Restarted || len(stale.Entries) != 3 {
		t.Fatalf("a stale cursor read %+v, %v; want the whole conversation, restarted", stale, err)
	}
}
