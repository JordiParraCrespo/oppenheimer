package transcript_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// qwenProject is where Qwen Code files the conversations of `/home/dev/src/app`.
const qwenProject = "-home-dev-src-app"

// writeQwen puts a conversation file in a Qwen `projects/` folder, under
// qwenProject, last written at.
func writeQwen(t *testing.T, projects, name, body string, at time.Time) {
	t.Helper()
	dir := filepath.Join(projects, qwenProject, "chats")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, name+".jsonl")
	if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(path, at, at); err != nil {
		t.Fatal(err)
	}
}

// A conversation Qwen Code 0.28.4 wrote (testdata/qwen, its paths scrubbed):
// a thought and a command, an approved write, a write again, a turn stopped
// before it answered, a command the person refused, a rewind, and a reply.
// It reaches the chat as the transcript lines it already draws, and none of
// the records Qwen keeps for itself does: telemetry, snapshots, the memory
// catalog it hands the model as a user message, the rewind. Regression: an
// empty Chat tab on a Qwen session, the memory catalog drawn as something
// the person said, or a refused command drawn as one that ran.
func TestAQwenConversationReadsAsTheChatsTranscript(t *testing.T) {
	sample, err := os.ReadFile(filepath.Join("testdata", "qwen", "conversation.jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	projects := t.TempDir()
	writeQwen(t, projects, conversation, string(sample), time.Now())
	sink := &batches{}
	followSession(t, transcript.Options{QwenProjects: projects},
		domain.Session{Agent: domain.AgentQwen, Place: domain.PlaceFolder, Folder: "/home/dev/src/app",
			Launch: domain.Launch{Conversation: conversation}}, sink)

	eventually(t, "the conversation", func() bool { return len(sink.entries()) == 20 })
	got := sink.entries()
	var said []string
	for _, entry := range got {
		if encoded, _ := json.Marshal(entry); strings.Contains(string(encoded), "memory catalog") {
			t.Fatalf("entry %v is the memory catalog Qwen keeps for the model", entry)
		}
		if block := blockOf(entry); entry["type"] == "user" && block["type"] == "text" {
			said = append(said, block["text"].(string))
		}
	}
	if want := []string{"think, then look around", "please write the hello file", "now write it again",
		"a slow plain one", "plain last words", "a danger command", "plain after rewind"}; strings.Join(said, "|") != strings.Join(want, "|") {
		t.Fatalf("prompts = %q, want %q", said, want)
	}
	first := blocksOf(got[1])
	if len(first) != 3 || first[0]["type"] != "thinking" || first[1]["text"] != "Let me look." || first[2]["name"] != "Bash" {
		t.Fatalf("first reply = %v, want the thought, the text and the command", first)
	}
	if input, _ := first[2]["input"].(map[string]any); input["command"] != "echo hello-from-tool" {
		t.Fatalf("command = %v", first[2]["input"])
	}
	if message, _ := got[1]["message"].(map[string]any); message["model"] != "fake-model" {
		t.Fatalf("reply names model %v, want the one that answered", message["model"])
	}
	if result := blockOf(got[2]); result["tool_use_id"] != first[2]["id"] || result["is_error"] == true ||
		!strings.Contains(result["content"].(string), "hello-from-tool") {
		t.Fatalf("result = %v, want the command's output", result)
	}
	write := blocksOf(got[5])
	if input, _ := write[1]["input"].(map[string]any); write[1]["name"] != "Write" || input["file_path"] != "/home/dev/src/app/hello.txt" {
		t.Fatalf("write = %v, want write_file as Write", write)
	}
	refused := blockOf(got[17])
	if refused["type"] != "tool_result" || refused["is_error"] != true || !strings.Contains(refused["content"].(string), "did not allow") {
		t.Fatalf("refused = %v, want the refusal as an error", refused)
	}
	if reply := blockOf(got[19]); reply["text"] != "Done: plain after rewind" {
		t.Fatalf("last entry = %v, want the reply after the rewind", got[19])
	}
}

// Qwen names the conversation by the session's id at launch, and moves to
// one of its own choosing on a `/clear`, or on a restart before anything was
// said (`--continue` opens a fresh one). In a worktree session the session's
// conversation is the newest written there since it was created, and not one
// of Qwen's own agents'; in a folder another Qwen may share, only the named
// one is. Regression: the chat and the session's conversation stuck on the
// file from before a `/clear`, or a folder session showing a neighbour's.
func TestAQwenSessionFollowsTheConversationItMovedTo(t *testing.T) {
	projects := t.TempDir()
	created := time.Now().Add(-time.Hour)
	line := `{"uuid":"u1","type":"user","provenance":"real_user","message":{"role":"user","parts":[{"text":"hi"}]}}` + "\n"
	reader := transcript.New(transcript.Options{QwenProjects: projects})
	worktree := domain.Session{Agent: domain.AgentQwen, Place: domain.PlaceWorktree, Worktree: "/home/dev/src/app",
		Created: created, Launch: domain.Launch{Conversation: conversation}}

	// Restarted before the first message: no file by the session's id yet.
	if got := reader.CurrentConversation(worktree); got != conversation {
		t.Fatalf("with nothing written, conversation = %q, want the session's own", got)
	}
	if reader.SavedConversation(worktree) {
		t.Fatal("with nothing written, the conversation reads as saved, which `--resume <id>` would exit on")
	}
	fresh := "0b7f6a3e-1111-4c2d-9e8f-000000000001"
	writeQwen(t, projects, fresh, line, created.Add(time.Minute))
	writeQwen(t, projects, "0b7f6a3e-1111-4c2d-9e8f-00000000000e", line, created.Add(-time.Minute))
	if got := reader.CurrentConversation(worktree); got != fresh {
		t.Fatalf("after a fresh --continue, conversation = %q, want %q", got, fresh)
	}

	writeQwen(t, projects, conversation, line, created.Add(2*time.Minute))
	if got := reader.CurrentConversation(worktree); got != conversation {
		t.Fatalf("named, conversation = %q, want %q", got, conversation)
	}
	if !reader.SavedConversation(worktree) {
		t.Fatal("written, the conversation does not read as saved, so a restart would not reopen it by id")
	}
	cleared := "0b7f6a3e-1111-4c2d-9e8f-000000000002"
	writeQwen(t, projects, cleared, line, created.Add(3*time.Minute))
	writeQwen(t, projects, "0b7f6a3e-1111-4c2d-9e8f-000000000003",
		`{"uuid":"s1","type":"system","subtype":"session_source","systemPayload":{"sourceType":"agent"}}`+"\n"+line, created.Add(4*time.Minute))
	if got := reader.CurrentConversation(worktree); got != cleared {
		t.Fatalf("after a /clear, conversation = %q, want %q and not Qwen's own agent's", got, cleared)
	}

	folder := domain.Session{Agent: domain.AgentQwen, Place: domain.PlaceFolder, Folder: "/home/dev/src/app",
		Created: created, Launch: domain.Launch{Conversation: conversation}}
	if got := reader.CurrentConversation(folder); got != conversation {
		t.Fatalf("in a shared folder, conversation = %q, want only the named one", got)
	}
}
