package transcript_test

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// payload is a status line payload as Claude Code sends it, abridged.
func payload(fiveHour float64) string {
	return `{"session_id":"` + conversation + `","model":{"id":"claude-opus-5-5"},"cost":{"total_cost_usd":1.2},` +
		`"context_window":{"total_input_tokens":64000,"context_window_size":200000,"used_percentage":32,"current_usage":{"input_tokens":8}},` +
		`"rate_limits":{"five_hour":{"used_percentage":` + jsonNumber(fiveHour) + `,"resets_at":1793040000},"seven_day":{"used_percentage":41.2,"resets_at":1793500000}}}`
}

func jsonNumber(f float64) string {
	encoded, _ := json.Marshal(f)
	return string(encoded)
}

func TestTheStatusKeepsTheContextAndThePlansWindowsAndNothingElse(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "statusline")
	status, err := transcript.SaveStatus(dir, []byte(payload(23.5)), "")
	if err != nil {
		t.Fatal(err)
	}
	if got := status.Text(); got != "ctx 32% · 5h 24% · 7d 41%" {
		t.Fatalf("line = %q", got)
	}
	saved, err := os.ReadFile(filepath.Join(dir, conversation+".json"))
	if err != nil {
		t.Fatal(err)
	}
	want := `{"type":"oppenheimer.status","context_window":{"used_percentage":32,"context_window_size":200000},` +
		`"rate_limits":{"five_hour":{"used_percentage":23.5,"resets_at":1793040000},"seven_day":{"used_percentage":41.2,"resets_at":1793500000}}}`
	if string(saved) != want {
		t.Fatalf("saved = %s", saved)
	}
	info, err := os.Stat(dir)
	if err != nil || info.Mode().Perm() != 0o700 {
		t.Fatalf("status dir mode = %v, %v", info.Mode().Perm(), err)
	}
}

func TestAStatusWithNoConversationIsNotKept(t *testing.T) {
	dir := t.TempDir()
	for _, body := range []string{`{"rate_limits":{}}`, `{"session_id":"../escape"}`, `not json`} {
		if _, err := transcript.SaveStatus(dir, []byte(body), ""); err == nil {
			t.Fatalf("%s was kept", body)
		} else if body != "not json" && !errors.Is(err, transcript.ErrNoStatus) {
			t.Fatalf("%s: %v", body, err)
		}
	}
	if entries, _ := os.ReadDir(dir); len(entries) != 0 {
		t.Fatalf("left behind: %v", entries)
	}
}

func TestAnAPIKeyAccountHasNoWindowsToShow(t *testing.T) {
	status, err := transcript.SaveStatus(t.TempDir(), []byte(`{"session_id":"`+conversation+`","context_window":{"context_window_size":200000}}`), "")
	if err != nil {
		t.Fatal(err)
	}
	if status.RateLimits != nil || status.Text() != "" {
		t.Fatalf("status = %+v, line %q", status, status.Text())
	}
}

func TestTheChatCarriesTheStatusAfterTheHistoryAndEachTimeItChanges(t *testing.T) {
	statusDir := t.TempDir()
	if _, err := transcript.SaveStatus(statusDir, []byte(payload(10)), ""); err != nil {
		t.Fatal(err)
	}
	projects := write(t, `{"type":"user","uuid":"u","message":{"role":"user","content":"Go"}}`)
	sink := &batches{}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = transcript.New(transcript.Options{ClaudeProjects: projects, StatusDir: statusDir}).
			Follow(ctx, domain.Session{Agent: domain.AgentClaude, Launch: domain.Launch{Conversation: conversation}}, 64<<10, 256, nil, sink.emit)
	}()
	t.Cleanup(func() { cancel(); <-done })

	statuses := func() []string {
		var out []string
		for _, entry := range sink.entries() {
			if entry["type"] == transcript.StatusEntryType {
				limits := entry["rate_limits"].(map[string]any)
				out = append(out, jsonNumber(limits["five_hour"].(map[string]any)["used_percentage"].(float64)))
			}
		}
		return out
	}
	eventually(t, "the history, then the status", func() bool {
		entries := sink.entries()
		return len(entries) == 2 && entries[0]["type"] == "user" && len(statuses()) == 1
	})
	// A write the clock cannot tell from the last one still differs in size.
	time.Sleep(20 * time.Millisecond)
	if _, err := transcript.SaveStatus(statusDir, []byte(payload(55.25)), ""); err != nil {
		t.Fatal(err)
	}
	eventually(t, "the new status", func() bool { return strings.Join(statuses(), ",") == "10,55.25" })
}

// After `/clear` or `/resume`, Claude Code writes to a conversation of
// another name, and says which only on its status line. The chat moves to
// that transcript and its status, the history starting over; following the
// conversation the session launched in froze the chat at its last turn
// while the terminal showed the agent still working.
func TestTheChatMovesToTheConversationTheAgentReportsMovingTo(t *testing.T) {
	const session, cleared = "6d0e4a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b", "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
	statusDir := t.TempDir()
	if _, err := transcript.SaveStatus(statusDir, []byte(payload(10)), session); err != nil {
		t.Fatal(err)
	}
	projects := write(t, promptLine)
	sink := &batches{}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = transcript.New(transcript.Options{ClaudeProjects: projects, StatusDir: statusDir}).
			Follow(ctx, domain.Session{ID: session, Agent: domain.AgentClaude, Launch: domain.Launch{Conversation: conversation}}, 64<<10, 256, nil, sink.emit)
	}()
	t.Cleanup(func() { cancel(); <-done })
	kinds := func() string {
		var out []string
		for _, entry := range sink.entries() {
			if entry["type"] == transcript.StatusEntryType {
				limits := entry["rate_limits"].(map[string]any)
				out = append(out, "status "+jsonNumber(limits["five_hour"].(map[string]any)["used_percentage"].(float64)))
			} else {
				out = append(out, entry["type"].(string))
			}
		}
		return strings.Join(out, ",")
	}
	eventually(t, "the launch conversation and its status", func() bool { return kinds() == "user,status 10" })

	folder := filepath.Join(projects, "-w-sessions-bold-otter-3f9a7k-oppenheimer")
	if err := os.WriteFile(filepath.Join(folder, cleared+".jsonl"), []byte(answerLine+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := transcript.SaveStatus(statusDir, []byte(strings.Replace(payload(55.25), conversation, cleared, 1)), session); err != nil {
		t.Fatal(err)
	}
	eventually(t, "the new conversation and its status", func() bool { return kinds() == "assistant,status 55.25" })
}

// A conversation `/clear` just opened has no transcript until the next
// message, and `claude --resume` refuses an id with none: the session keeps
// the one it holds until the agent writes the new one, or a Restart in
// between would kill window 0 on "No conversation found".
func TestAReportedConversationCountsOnceItsTranscriptIsWritten(t *testing.T) {
	const session, cleared = "6d0e4a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b", "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
	statusDir := t.TempDir()
	projects := write(t, promptLine)
	reader := transcript.New(transcript.Options{ClaudeProjects: projects, StatusDir: statusDir})
	of := domain.Session{ID: session, Agent: domain.AgentClaude, Launch: domain.Launch{Conversation: conversation}}
	if _, err := transcript.SaveStatus(statusDir, []byte(strings.Replace(payload(10), conversation, cleared, 1)), session); err != nil {
		t.Fatal(err)
	}
	if got := reader.ReportedConversation(of); got != "" {
		t.Fatalf("reported = %q before its transcript was written", got)
	}
	folder := filepath.Join(projects, "-w-sessions-bold-otter-3f9a7k-oppenheimer")
	if err := os.WriteFile(filepath.Join(folder, cleared+".jsonl"), []byte(promptLine+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := reader.ReportedConversation(of); got != cleared {
		t.Fatalf("reported = %q, want %q once its transcript is written", got, cleared)
	}
}

// Only the status line of a session's window-0 agent names the session; any
// other Claude Code's figures are kept and say nothing of which conversation
// a session is in, and a session that is no name is never a path.
func TestAStatusLineThatNamesNoSessionReportsNoConversation(t *testing.T) {
	statusDir := t.TempDir()
	for _, session := range []string{"", "../escape"} {
		if _, err := transcript.SaveStatus(statusDir, []byte(payload(10)), session); err != nil {
			t.Fatal(err)
		}
		if got := transcript.ReportedConversation(statusDir, session); got != "" {
			t.Fatalf("session %q reported %q", session, got)
		}
	}
	if _, err := os.Stat(filepath.Join(statusDir, "sessions")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("a session's conversation was kept: %v", err)
	}
}
