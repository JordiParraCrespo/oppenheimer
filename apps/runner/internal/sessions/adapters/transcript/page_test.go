package transcript_test

import (
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A session's conversation read one page at a time on request
// (`transcript.read`), for a bot or the CLI with no browser attached.

var claudeSession = domain.Session{Agent: domain.AgentClaude, Launch: domain.Launch{Conversation: conversation}}

// pageOf reads one page of the Claude Code conversation under projects.
func pageOf(t *testing.T, projects string, req app.TranscriptPageRequest) app.TranscriptPage {
	t.Helper()
	if req.Limit == 0 {
		req.Limit = 200
	}
	req.BytesMax, req.EntryMax = max(req.BytesMax, 256<<10), 64<<10
	page, err := transcript.New(transcript.Options{ClaudeProjects: projects}).ReadPage(claudeSession, req)
	if err != nil {
		t.Fatal(err)
	}
	if page.Entries == nil {
		t.Fatal("a page's entries are nil, which the link carries as null")
	}
	return page
}

// entryUUIDs is the uuid of each of a page's entries, in order.
func entryUUIDs(entries []string) []string {
	out := make([]string, 0, len(entries))
	for _, entry := range entries {
		var decoded struct {
			UUID string `json:"uuid"`
		}
		_ = json.Unmarshal([]byte(entry), &decoded)
		out = append(out, decoded.UUID)
	}
	return out
}

func claudeFile(projects string) string {
	return filepath.Join(projects, "-w-sessions-bold-otter-3f9a7k-oppenheimer", conversation+".jsonl")
}

// The tail is the last turns that reach the end within the page, from where
// the first of them opens, and its conversation is a name, never the path.
// Regression: a bot asking what a session said got its first turns, a page
// that stopped short of the end, or the host's path in the cursor.
func TestATailPageIsTheLastTurnsThatReachTheEnd(t *testing.T) {
	lines := turnLines(50)
	projects := write(t, lines...)

	for _, tc := range []struct {
		name  string
		limit int
		first string
		from  int
	}{
		{name: "forty turns fit", limit: 200, first: "p10", from: 40},
		{name: "a smaller page holds fewer turns", limit: 20, first: "p45", from: 180},
	} {
		t.Run(tc.name, func(t *testing.T) {
			page := pageOf(t, projects, app.TranscriptPageRequest{Limit: tc.limit})
			got := entryUUIDs(page.Entries)
			if got[0] != tc.first || got[len(got)-1] != "a49" || !page.AtEnd {
				t.Fatalf("the tail runs %s..%s (at end %v), want %s..a49", got[0], got[len(got)-1], page.AtEnd, tc.first)
			}
			if page.From != offsetOf(lines, tc.from) || page.Next != offsetOf(lines, len(lines)) {
				t.Fatalf("from %d next %d", page.From, page.Next)
			}
			if !regexp.MustCompile(`^[A-Za-z0-9_-]{1,64}$`).MatchString(page.Conversation) ||
				strings.Contains(page.Conversation, conversation) {
				t.Fatalf("conversation = %q", page.Conversation)
			}
		})
	}
}

// A cursor reads what the agent wrote after it, and the page's Next is the
// cursor for what it writes after that. Regression: a follow-up read
// replayed the whole tail, or skipped the lines appended since.
func TestAPageAfterACursorIsOnlyWhatCameAfterIt(t *testing.T) {
	projects := write(t, turnLines(2)...)
	first := pageOf(t, projects, app.TranscriptPageRequest{})
	appendLines(t, claudeFile(projects),
		`{"type":"user","uuid":"p2","message":{"role":"user","content":"Prompt 2"}}`,
		`{"type":"assistant","uuid":"a2","message":{"role":"assistant","content":[{"type":"text","text":"Reply 2"}]}}`)

	second := pageOf(t, projects, app.TranscriptPageRequest{Conversation: first.Conversation, After: first.Next})
	if got := entryUUIDs(second.Entries); !slices.Equal(got, []string{"p2", "a2"}) || second.Restarted || second.From != first.Next {
		t.Fatalf("the page after the cursor = %v (restarted %v, from %d)", got, second.Restarted, second.From)
	}
	third := pageOf(t, projects, app.TranscriptPageRequest{Conversation: first.Conversation, After: second.Next})
	if len(third.Entries) != 0 || !third.AtEnd || third.Next != second.Next {
		t.Fatalf("the page at the end = %v, next %d", third.Entries, third.Next)
	}
}

// A cursor that no longer applies reads the current conversation from its
// start, said so. Regression: a stale offset read a line from its middle,
// or into another conversation's file.
func TestACursorThatNoLongerAppliesStartsOver(t *testing.T) {
	lines := turnLines(3)
	projects := write(t, lines...)
	name := pageOf(t, projects, app.TranscriptPageRequest{}).Conversation

	for _, tc := range []struct {
		name string
		req  app.TranscriptPageRequest
	}{
		{name: "another conversation", req: app.TranscriptPageRequest{Conversation: "0123456789abcdef", After: offsetOf(lines, 4)}},
		{name: "the middle of a line", req: app.TranscriptPageRequest{Conversation: name, After: offsetOf(lines, 4) + 3}},
		{name: "past the end", req: app.TranscriptPageRequest{Conversation: name, After: offsetOf(lines, len(lines)) + 10}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			page := pageOf(t, projects, tc.req)
			if got := entryUUIDs(page.Entries); !page.Restarted || page.From != 0 || len(got) != 12 || got[0] != "p0" {
				t.Fatalf("page = %v (restarted %v, from %d)", got, page.Restarted, page.From)
			}
		})
	}
}

// Pages read one after another hold every entry once. Regression: a page
// cut by its limit lost the line it stopped at, or read it twice.
func TestConsecutivePagesNeitherLoseNorRepeatAnEntry(t *testing.T) {
	projects := write(t, turnLines(10)...)
	whole := entryUUIDs(pageOf(t, projects, app.TranscriptPageRequest{Conversation: "x"}).Entries)

	var got []string
	name := pageOf(t, projects, app.TranscriptPageRequest{}).Conversation
	after := int64(0)
	for range 20 {
		page := pageOf(t, projects, app.TranscriptPageRequest{Conversation: name, After: after, Limit: 7})
		if len(page.Entries) > 7 || page.Dropped != 0 {
			t.Fatalf("a page of 7 holds %d, dropped %d", len(page.Entries), page.Dropped)
		}
		got = append(got, entryUUIDs(page.Entries)...)
		if page.AtEnd {
			break
		}
		after = page.Next
	}
	if len(whole) != 40 || !slices.Equal(got, whole) {
		t.Fatalf("pages of 7 read %d entries, the whole conversation is %d", len(got), len(whole))
	}
}

// A line the CLI is still writing is left for the next page. Regression: a
// half line was read as nothing and the cursor moved past it, so the
// message never reached the reader.
func TestALineStillBeingWrittenIsLeftForTheNextPage(t *testing.T) {
	lines := turnLines(1)
	projects := write(t, lines...)
	half := `{"type":"user","uuid":"p1","message":{"role":"user","content":"Prompt 1"}}`
	file, err := os.OpenFile(claudeFile(projects), os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = file.WriteString(half[:20])
	_ = file.Close()

	page := pageOf(t, projects, app.TranscriptPageRequest{})
	if got := entryUUIDs(page.Entries); len(got) != 4 || page.Next != offsetOf(lines, len(lines)) || !page.AtEnd {
		t.Fatalf("page = %v, next %d, at end %v", got, page.Next, page.AtEnd)
	}
	appendLines(t, claudeFile(projects), half[20:])
	next := pageOf(t, projects, app.TranscriptPageRequest{Conversation: page.Conversation, After: page.Next})
	if got := entryUUIDs(next.Entries); !slices.Equal(got, []string{"p1"}) {
		t.Fatalf("the finished line read as %v", got)
	}
}

// A session whose agent has written nothing yet has an empty page, at its
// end, with an empty list of entries. Regression: entries went as null,
// which the control plane refuses.
func TestNothingWrittenYetIsAnEmptyPage(t *testing.T) {
	page := pageOf(t, t.TempDir(), app.TranscriptPageRequest{})
	if page.Conversation != "" || len(page.Entries) != 0 || !page.AtEnd || page.Next != 0 {
		t.Fatalf("page = %+v", page)
	}
}

// An agent with no transcript file this runner reads says so, rather than
// answering an empty page that reads as a silent session. Regression: a bot
// waited on an OpenCode session that would never write one.
func TestAnAgentWithNoTranscriptFileIsRefused(t *testing.T) {
	reader := transcript.New(transcript.Options{ClaudeProjects: t.TempDir()})
	for name, session := range map[string]domain.Session{
		"opencode":           {Agent: domain.AgentOpenCode},
		"a shell":            {Agent: domain.AgentShell},
		"no conversation":    {Agent: domain.AgentClaude},
		"codex with no home": {Agent: domain.AgentCodex},
	} {
		_, err := reader.ReadPage(session, app.TranscriptPageRequest{Limit: 10, BytesMax: 1 << 10, EntryMax: 1 << 10})
		if !errors.Is(err, app.ErrNoChat) {
			t.Fatalf("%s: err = %v, want ErrNoChat", name, err)
		}
	}
}

// A reply an agent writes in chunks (Grok's) is on a page only once the
// chunks stop, and the page ends before it until then, so the next one
// reads it whole. Regression: a page cut the reply being written, and the
// next page, read with a fresh transcriber, lost its first chunks.
func TestAReplyStillBeingWrittenWaitsForTheNextPage(t *testing.T) {
	sessions := t.TempDir()
	dir := filepath.Join(sessions, url.PathEscape("/w/sessions/xrp"), conversation)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "updates.jsonl")
	lines := []string{
		chunk("user_message_chunk", "Fix the wallet test"),
		acpLine(map[string]any{"sessionUpdate": "tool_call", "toolCallId": "t1", "title": "bash", "kind": "execute", "status": "completed",
			"rawInput": map[string]any{"command": "pnpm test"}}),
		chunk("agent_message_chunk", "Fixed: "),
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	reader := transcript.New(transcript.Options{GrokSessions: sessions})
	session := domain.Session{Agent: domain.AgentGrok, Launch: domain.Launch{Conversation: conversation}}
	req := app.TranscriptPageRequest{Limit: 200, BytesMax: 256 << 10, EntryMax: 64 << 10}

	first, err := reader.ReadPage(session, req)
	if err != nil {
		t.Fatal(err)
	}
	held := int64(len(lines[0]) + len(lines[1]) + 2)
	if first.Next != held || !first.AtEnd {
		t.Fatalf("a page with a reply being written ends at %d (at end %v), want %d", first.Next, first.AtEnd, held)
	}
	for _, entry := range first.Entries {
		if strings.Contains(entry, "Fixed") {
			t.Fatalf("the reply being written is on the page: %s", entry)
		}
	}

	appendLines(t, path, chunk("agent_message_chunk", "it had no initial value."))
	quiet := time.Now().Add(-time.Minute)
	if err := os.Chtimes(path, quiet, quiet); err != nil {
		t.Fatal(err)
	}
	req.Conversation, req.After = first.Conversation, first.Next
	second, err := reader.ReadPage(session, req)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Entries) != 1 || !strings.Contains(second.Entries[0], "Fixed: it had no initial value.") || !second.Partial {
		t.Fatalf("the reply once quiet = %v (partial %v)", second.Entries, second.Partial)
	}
}

// A quiet reply that does not fit the page is left for the next one, whole.
// Regression: quiet flushed the reply out of the transcriber, the page
// refused it for its bounds, and the cursor still moved past its lines, so
// the agent's final answer was on no page at all.
func TestAQuietReplyThatDoesNotFitIsOnTheNextPage(t *testing.T) {
	sessions := t.TempDir()
	dir := filepath.Join(sessions, url.PathEscape("/w/sessions/xrp"), conversation)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "updates.jsonl")
	lines := []string{
		chunk("user_message_chunk", "Fix the wallet test"),
		acpLine(map[string]any{"sessionUpdate": "tool_call", "toolCallId": "t1", "title": "bash", "kind": "execute", "status": "completed",
			"rawInput": map[string]any{"command": "pnpm test"}}),
		chunk("agent_message_chunk", "Fixed: it had no initial value."),
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	quiet := time.Now().Add(-time.Minute)
	if err := os.Chtimes(path, quiet, quiet); err != nil {
		t.Fatal(err)
	}
	reader := transcript.New(transcript.Options{GrokSessions: sessions})
	session := domain.Session{Agent: domain.AgentGrok, Launch: domain.Launch{Conversation: conversation}}
	req := app.TranscriptPageRequest{Limit: 200, BytesMax: 256 << 10, EntryMax: 64 << 10}

	whole, err := reader.ReadPage(session, req)
	if err != nil {
		t.Fatal(err)
	}
	if len(whole.Entries) < 2 || !strings.Contains(whole.Entries[len(whole.Entries)-1], "Fixed") {
		t.Fatalf("the whole conversation = %v", whole.Entries)
	}

	req.Limit = len(whole.Entries) - 1
	first, err := reader.ReadPage(session, req)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range first.Entries {
		if strings.Contains(entry, "Fixed") {
			t.Fatalf("the reply is on a page it does not fit: %v", first.Entries)
		}
	}
	if first.AtEnd {
		t.Fatal("a page that left the reply out says it reached the end")
	}
	req.Conversation, req.After = first.Conversation, first.Next
	second, err := reader.ReadPage(session, req)
	if err != nil {
		t.Fatal(err)
	}
	if len(second.Entries) == 0 || !strings.Contains(second.Entries[len(second.Entries)-1], "Fixed: it had no initial value.") {
		t.Fatalf("the reply is on no page: first %v, second %v", first.Entries, second.Entries)
	}
}
