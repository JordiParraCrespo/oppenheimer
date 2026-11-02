package transcript_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// followSession follows a session's chat with the reader opts make, until
// the test ends.
func followSession(t *testing.T, opts transcript.Options, session domain.Session, sink *batches) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = transcript.New(opts).Follow(ctx, session, 64<<10, 256, sink.emit)
	}()
	t.Cleanup(func() { cancel(); <-done })
}

// rolloutLine is one line of a Codex rollout, as the CLI writes it.
func rolloutLine(kind string, payload map[string]any) string {
	line, _ := json.Marshal(map[string]any{"timestamp": "2026-11-02T10:00:00.000Z", "type": kind, "payload": payload})
	return string(line)
}

// writeRollout writes a rollout where Codex keeps today's, modified at.
func writeRollout(t *testing.T, sessions, name string, at time.Time, lines ...string) string {
	t.Helper()
	now := time.Now()
	dir := filepath.Join(sessions, now.Format("2006"), now.Format("01"), now.Format("02"))
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "rollout-"+name+".jsonl")
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(path, at, at); err != nil {
		t.Fatal(err)
	}
	return path
}

func appendLines(t *testing.T, path string, lines ...string) {
	t.Helper()
	file, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0o600) //nolint:gosec // the test's own file
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = file.Close() }()
	if _, err := file.WriteString(strings.Join(lines, "\n") + "\n"); err != nil {
		t.Fatal(err)
	}
}

// A Codex session's rollout reaches the chat as the transcript lines it
// already draws: what the person typed (not the context Codex injects), the
// reasoning summary, a command as Bash with its exit code read as failure, a
// patch as an Edit per file with its lines, the reply under its model, the
// context and the plan's windows as the status, and a stopped turn as the
// interrupted note. Another directory's rollout, and one of this directory's
// from before the session, are never read. Regression: an empty Chat tab on a
// Codex session, a stranger's conversation in it, or Codex's injected context
// shown as the person's prompt.
func TestACodexRolloutReadsAsTheChatsTranscript(t *testing.T) {
	sessions, worktree := t.TempDir(), t.TempDir()
	created := time.Now().Add(-time.Minute)
	meta := func(cwd string) string {
		return rolloutLine("session_meta", map[string]any{"id": "019a", "cwd": cwd, "originator": "codex_cli_rs"})
	}
	writeRollout(t, sessions, "other", time.Now(), meta(t.TempDir()),
		rolloutLine("event_msg", map[string]any{"type": "user_message", "message": "another worktree"}))
	writeRollout(t, sessions, "older", created.Add(-time.Hour), meta(worktree),
		rolloutLine("event_msg", map[string]any{"type": "user_message", "message": "before the session"}))
	path := writeRollout(t, sessions, "mine", time.Now(), meta(worktree),
		rolloutLine("turn_context", map[string]any{"cwd": worktree, "model": "gpt-6.1-sol"}),
		rolloutLine("response_item", map[string]any{"type": "message", "role": "user", "content": []any{
			map[string]any{"type": "input_text", "text": "<environment_context>injected</environment_context>"},
		}}),
		rolloutLine("event_msg", map[string]any{"type": "user_message", "message": "Fix the wallet test"}),
		rolloutLine("response_item", map[string]any{"type": "reasoning", "summary": []any{
			map[string]any{"type": "summary_text", "text": "**Reading the test**"},
		}, "encrypted_content": "x"}),
		rolloutLine("response_item", map[string]any{"type": "function_call", "name": "exec_command", "call_id": "call_1",
			"arguments": `{"cmd":"pnpm test wallet","workdir":"/w"}`}),
		rolloutLine("response_item", map[string]any{"type": "function_call_output", "call_id": "call_1",
			"output": "Chunk ID: 1\nWall time: 2.1 seconds\nProcess exited with code 1\nOutput:\n1 failed"}),
		rolloutLine("response_item", map[string]any{"type": "custom_tool_call", "name": "apply_patch", "call_id": "call_2", "status": "completed",
			"input": "*** Begin Patch\n*** Update File: src/wallet.ts\n@@\n-  return rows.reduce(add);\n+  return rows.reduce(add, 0);\n*** End Patch\n"}),
		rolloutLine("response_item", map[string]any{"type": "custom_tool_call_output", "call_id": "call_2",
			"output": `{"output":"Success. Updated the following files:\nM src/wallet.ts\n","metadata":{"exit_code":0}}`}),
		rolloutLine("response_item", map[string]any{"type": "message", "role": "assistant", "content": []any{
			map[string]any{"type": "output_text", "text": "Fixed: reduce had no initial value."},
		}}),
		rolloutLine("event_msg", map[string]any{"type": "token_count",
			"info": map[string]any{"last_token_usage": map[string]any{"input_tokens": 50000, "output_tokens": 4000, "total_tokens": 54000}, "model_context_window": 270000},
			"rate_limits": map[string]any{
				"primary":   map[string]any{"used_percent": 23.0, "window_minutes": 300, "resets_at": 1793040000},
				"secondary": map[string]any{"used_percent": 41.0, "window_minutes": 10080},
			}}),
	)
	sink := &batches{}
	followSession(t, transcript.Options{CodexSessions: sessions},
		domain.Session{Agent: domain.AgentCodex, Worktree: worktree, Created: created}, sink)

	eventually(t, "the rollout", func() bool { return len(sink.entries()) == 8 })
	got := sink.entries()
	if block := blockOf(got[0]); got[0]["type"] != "user" || block["text"] != "Fix the wallet test" {
		t.Fatalf("first entry = %v, want the person's prompt alone", got[0])
	}
	if block := blockOf(got[1]); block["type"] != "thinking" || block["thinking"] != "**Reading the test**" {
		t.Fatalf("second entry = %v, want the reasoning summary", got[1])
	}
	call := blockOf(got[2])
	if input, _ := call["input"].(map[string]any); call["name"] != "Bash" || input["command"] != "pnpm test wallet" || call["id"] != "call_1" {
		t.Fatalf("third entry = %v, want the command as Bash", got[2])
	}
	if result := blockOf(got[3]); result["tool_use_id"] != "call_1" || result["is_error"] != true || result["content"] != "1 failed" {
		t.Fatalf("fourth entry = %v, want the command's output, failed", got[3])
	}
	edit := blockOf(got[4])
	if input, _ := edit["input"].(map[string]any); edit["name"] != "Edit" || input["file_path"] != "src/wallet.ts" ||
		input["old_string"] != "  return rows.reduce(add);" || input["new_string"] != "  return rows.reduce(add, 0);" {
		t.Fatalf("fifth entry = %v, want the patch as an Edit", got[4])
	}
	if result := blockOf(got[5]); result["tool_use_id"] != "call_2" || result["is_error"] == true {
		t.Fatalf("sixth entry = %v, want the patch's result", got[5])
	}
	reply := got[6]
	if message, _ := reply["message"].(map[string]any); blockOf(reply)["text"] != "Fixed: reduce had no initial value." || message["model"] != "gpt-6.1-sol" {
		t.Fatalf("seventh entry = %v, want the reply under its model", reply)
	}
	status := got[7]
	context, _ := status["context_window"].(map[string]any)
	limits, _ := status["rate_limits"].(map[string]any)
	fiveHour, _ := limits["five_hour"].(map[string]any)
	sevenDay, _ := limits["seven_day"].(map[string]any)
	if status["type"] != transcript.StatusEntryType || context["used_percentage"] != 20.0 || context["context_window_size"] != 270000.0 ||
		fiveHour["used_percentage"] != 23.0 || sevenDay["used_percentage"] != 41.0 {
		t.Fatalf("eighth entry = %v, want the context and the plan's windows as the status", status)
	}

	appendLines(t, path, rolloutLine("event_msg", map[string]any{"type": "turn_aborted", "reason": "interrupted"}))
	eventually(t, "the stop", func() bool { return len(sink.entries()) == 9 })
	if stop := blockOf(sink.entries()[8]); stop["text"] != "[Request interrupted by user]" {
		t.Fatalf("last entry = %v, want the interrupted note", stop)
	}
}
