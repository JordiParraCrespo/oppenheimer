package transcript_test

import (
	"encoding/json"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// acpLine is one line of Grok's `updates.jsonl`: an ACP session update, in
// the notification that carries it.
func acpLine(update map[string]any) string {
	line, _ := json.Marshal(map[string]any{"sessionId": conversation, "update": update})
	return string(line)
}

func chunk(kind, text string) string {
	return acpLine(map[string]any{"sessionUpdate": kind, "content": map[string]any{"type": "text", "text": text}})
}

// A Grok session's ACP updates reach the chat as the transcript lines it
// already draws: the prompt and the reply whole however many chunks they came
// in, a command as Bash once it runs and its result once it ends, an edit as
// an Edit with its diff once it is done, the plan as the task list. The
// session's folder is found by the session's own id, whichever directory
// Grok filed it under. Regression: an empty Chat tab on a Grok session, or a
// reply drawn a word per line.
func TestAGrokSessionsUpdatesReadAsTheChatsTranscript(t *testing.T) {
	sessions := t.TempDir()
	dir := filepath.Join(sessions, url.PathEscape("/w/sessions/xrp"), conversation)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "updates.jsonl")
	lines := []string{
		chunk("user_message_chunk", "Fix the "),
		chunk("user_message_chunk", "wallet test"),
		chunk("agent_thought_chunk", "Run it first."),
		acpLine(map[string]any{"sessionUpdate": "tool_call", "toolCallId": "t1", "title": "bash", "kind": "execute", "status": "in_progress",
			"rawInput": map[string]any{"command": "pnpm test wallet"}}),
		acpLine(map[string]any{"sessionUpdate": "tool_call_update", "toolCallId": "t1", "status": "completed",
			"content": []any{map[string]any{"type": "content", "content": map[string]any{"type": "text", "text": "1 failed"}}}}),
		acpLine(map[string]any{"sessionUpdate": "tool_call", "toolCallId": "t2", "title": "search_replace", "kind": "edit", "status": "pending",
			"locations": []any{map[string]any{"path": "/w/src/wallet.ts"}}}),
		acpLine(map[string]any{"sessionUpdate": "tool_call_update", "toolCallId": "t2", "status": "completed",
			"content": []any{map[string]any{"type": "diff", "path": "/w/src/wallet.ts", "oldText": "reduce(add)", "newText": "reduce(add, 0)"}}}),
		acpLine(map[string]any{"sessionUpdate": "plan", "entries": []any{
			map[string]any{"content": "Fix reduce", "priority": "high", "status": "completed"},
		}}),
		chunk("agent_message_chunk", "Fixed: "),
		chunk("agent_message_chunk", "it had no initial value."),
	}
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	sink := &batches{}
	followSession(t, transcript.Options{GrokSessions: sessions},
		domain.Session{Agent: domain.AgentGrok, Launch: domain.Launch{Conversation: conversation}}, sink)

	// The reply is whole once the chunks stop.
	eventually(t, "the updates", func() bool { return len(sink.entries()) == 9 })
	got := sink.entries()
	if block := blockOf(got[0]); got[0]["type"] != "user" || block["text"] != "Fix the wallet test" {
		t.Fatalf("first entry = %v, want the prompt whole", got[0])
	}
	if block := blockOf(got[1]); block["type"] != "thinking" || block["thinking"] != "Run it first." {
		t.Fatalf("second entry = %v, want the thought", got[1])
	}
	bash := blockOf(got[2])
	if input, _ := bash["input"].(map[string]any); bash["name"] != "Bash" || input["command"] != "pnpm test wallet" {
		t.Fatalf("third entry = %v, want the command as Bash", got[2])
	}
	if result := blockOf(got[3]); result["tool_use_id"] != "t1" || result["content"] != "1 failed" {
		t.Fatalf("fourth entry = %v, want the command's output", got[3])
	}
	edit := blockOf(got[4])
	if input, _ := edit["input"].(map[string]any); edit["name"] != "Edit" || input["file_path"] != "/w/src/wallet.ts" ||
		input["old_string"] != "reduce(add)" || input["new_string"] != "reduce(add, 0)" {
		t.Fatalf("fifth entry = %v, want the edit with its diff", got[4])
	}
	if blockOf(got[5])["tool_use_id"] != "t2" {
		t.Fatalf("sixth entry = %v, want the edit's result", got[5])
	}
	if todo := blockOf(got[6]); todo["name"] != "TodoWrite" {
		t.Fatalf("seventh entry = %v, want the plan as the task list", got[6])
	}
	if reply := blockOf(got[8]); reply["text"] != "Fixed: it had no initial value." {
		t.Fatalf("last entry = %v, want the reply whole", got[8])
	}
}
