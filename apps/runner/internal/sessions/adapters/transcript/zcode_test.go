package transcript_test

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// zcodeDB is a ZCode database with the three tables the chat reads, laid out
// as ZCode 4.0.0 (CLI 0.18.0) writes them.
type zcodeDB struct {
	path string
	db   *sql.DB
}

func newZCodeDB(t *testing.T) *zcodeDB {
	t.Helper()
	path := filepath.Join(t.TempDir(), "db.sqlite")
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=journal_mode(WAL)")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	for _, stmt := range []string{
		`CREATE TABLE session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, time_archived integer, time_deleted integer)`,
		`CREATE TABLE message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null, sequence integer)`,
		`CREATE TABLE part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null, sequence integer)`,
	} {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatal(err)
		}
	}
	return &zcodeDB{path: path, db: db}
}

func (z *zcodeDB) exec(t *testing.T, stmt string, args ...any) {
	t.Helper()
	if _, err := z.db.Exec(stmt, args...); err != nil {
		t.Fatal(err)
	}
}

func (z *zcodeDB) conversation(t *testing.T, id, directory string, updated int64) {
	t.Helper()
	z.exec(t, `INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated) VALUES (?, 'p', ?, ?, 't', '0.18.0', ?, ?)`,
		id, id, directory, updated, updated)
}

func (z *zcodeDB) message(t *testing.T, session, id string, at int64, data string, parts ...string) {
	t.Helper()
	z.exec(t, `INSERT INTO message (id, session_id, time_created, time_updated, data) VALUES (?, ?, ?, ?, ?)`, id, session, at, at, data)
	for i, part := range parts {
		z.exec(t, `INSERT INTO part (id, message_id, session_id, time_created, time_updated, data, sequence) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			id+"-p"+string(rune('0'+i)), id, session, at, at, part, i)
	}
}

func followZCode(t *testing.T, db, directory string, created time.Time, sink *batches) {
	t.Helper()
	reader := transcript.New(transcript.Options{ZCodeDatabase: db})
	session := domain.Session{Agent: domain.AgentZCode, Place: domain.PlaceFolder, Folder: directory, Created: created}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = reader.Follow(ctx, session, 64<<10, 256, nil, sink.emit)
	}()
	t.Cleanup(func() { cancel(); <-done })
}

// A ZCode conversation reaches the chat as the transcript it already draws:
// the person's words, ZCode's reply, and a tool call with its result, read
// from ZCode's database in OpenCode's shapes. The messages ZCode writes for
// the model alone (its environment, the date) never show.
// Regression: ZCode's reminders shown as if the person had typed them, a
// tool call missing, or a conversation in another folder taken for the
// session's.
func TestAZCodeConversationReadsAsTheChatsTranscript(t *testing.T) {
	z := newZCodeDB(t)
	dir := t.TempDir()
	start := time.UnixMilli(1_795_000_000_000)
	z.conversation(t, "sess_other", t.TempDir(), start.UnixMilli()+50)
	z.message(t, "sess_other", "msg_x", start.UnixMilli()+50, `{"role":"user","time":{"created":1}}`, `{"type":"text","text":"not this one"}`)

	z.conversation(t, "sess_mine", dir, start.UnixMilli()+10)
	z.message(t, "sess_mine", "msg_a", start.UnixMilli()+1,
		`{"role":"user","time":{"created":1795000000001},"agent":"zcode-agent"}`,
		`{"type":"text","text":"Create HELLO.md","time":{"start":1795000000001,"end":1795000000001}}`)
	z.message(t, "sess_mine", "msg_b", start.UnixMilli()+2,
		`{"role":"user","time":{"created":1795000000002},"metadata":{"source":"date","visibility":"model-only"},"semantics":{"uiVisibility":"hidden"}}`,
		`{"type":"text","text":"Today's date is 2026-11-23.","synthetic":true}`)
	z.message(t, "sess_mine", "msg_c", start.UnixMilli()+3,
		`{"role":"assistant","time":{"created":1795000000003,"completed":1795000000009},"modelId":"glm-5.3","providerId":"zai"}`,
		`{"type":"step-start"}`,
		`{"type":"tool","callID":"call_1","tool":"Write","state":{"status":"completed","input":{"file_path":"/w/HELLO.md","content":"hi"},"output":"Wrote 1 line","title":"Write","metadata":{},"time":{"start":1795000000004,"end":1795000000005}}}`,
		`{"type":"text","text":"Done.","time":{"start":1795000000006,"end":1795000000008}}`,
		`{"type":"step-finish","reason":"stop"}`)

	sink := &batches{}
	followZCode(t, z.path, dir, start, sink)

	eventually(t, "the conversation", func() bool { return len(sink.entries()) == 4 })
	got := sink.entries()
	if block := blockOf(got[0]); got[0]["type"] != "user" || block["text"] != "Create HELLO.md" {
		t.Fatalf("first entry = %v, want the person's words", got[0])
	}
	if block := blockOf(got[1]); block["type"] != "tool_use" || block["name"] != "Write" {
		t.Fatalf("second entry = %v, want the Write call", got[1])
	}
	if block := blockOf(got[2]); block["type"] != "tool_result" || block["content"] != "Wrote 1 line" {
		t.Fatalf("third entry = %v, want the Write result", got[2])
	}
	if block := blockOf(got[3]); block["text"] != "Done." {
		t.Fatalf("fourth entry = %v, want the reply", got[3])
	}

	// A reply written later arrives on the next read.
	z.message(t, "sess_mine", "msg_d", start.UnixMilli()+20,
		`{"role":"assistant","time":{"created":1795000000020,"completed":1795000000021},"modelId":"glm-5.3"}`,
		`{"type":"text","text":"Anything else?","time":{"start":1795000000020,"end":1795000000021}}`)
	z.exec(t, `UPDATE session SET time_updated = ? WHERE id = 'sess_mine'`, start.UnixMilli()+21)
	eventually(t, "the later reply", func() bool { return lastText(sink) == "Anything else?" })
}

// A session whose ZCode has not written its database yet waits for it, and
// its conversation appears once ZCode makes it.
// Regression: a missing database read as a broken chat that never recovers.
func TestTheChatWaitsForZCodesFirstConversation(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(t.TempDir(), "db.sqlite")
	sink := &batches{}
	start := time.UnixMilli(1_795_000_000_000)
	followZCode(t, path, dir, start, sink)

	z := &zcodeDB{path: path}
	db, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	z.db = db
	for _, stmt := range []string{
		`CREATE TABLE session (id text primary key, project_id text not null, parent_id text, slug text not null, directory text not null, title text not null, version text not null, time_created integer not null, time_updated integer not null, time_archived integer, time_deleted integer)`,
		`CREATE TABLE message (id text primary key, session_id text not null, time_created integer not null, time_updated integer not null, data text not null, sequence integer)`,
		`CREATE TABLE part (id text primary key, message_id text not null, session_id text not null, time_created integer not null, time_updated integer not null, data text not null, sequence integer)`,
	} {
		z.exec(t, stmt)
	}
	z.conversation(t, "sess_new", dir, start.UnixMilli()+5)
	z.message(t, "sess_new", "msg_a", start.UnixMilli()+5, `{"role":"user","time":{"created":1795000000005}}`, `{"type":"text","text":"hello"}`)

	eventually(t, "the first conversation", func() bool { return lastText(sink) == "hello" })
}
