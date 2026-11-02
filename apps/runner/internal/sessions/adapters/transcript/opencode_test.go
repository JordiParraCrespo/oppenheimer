package transcript_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const openCodePassword = "the-session-password"

// openCode is OpenCode's local API as its TUI serves it: the conversations
// in the folder and their messages, newest last, behind the session's
// password. It answers `limit` with the newest messages, as OpenCode does.
type openCode struct {
	mu       sync.Mutex
	sessions []map[string]any
	messages map[string][]map[string]any
	reads    int
	// asked is the directory the last session list was asked for.
	asked  string
	server *httptest.Server
}

func newOpenCode(t *testing.T) *openCode {
	t.Helper()
	oc := &openCode{messages: map[string][]map[string]any{}}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /session", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("roots") != "true" {
			http.Error(w, "roots only", http.StatusBadRequest)
			return
		}
		oc.mu.Lock()
		defer oc.mu.Unlock()
		oc.asked = r.URL.Query().Get("directory")
		_ = json.NewEncoder(w).Encode(oc.sessions)
	})
	mux.HandleFunc("GET /session/{id}/message", func(w http.ResponseWriter, r *http.Request) {
		oc.mu.Lock()
		defer oc.mu.Unlock()
		oc.reads++
		list := oc.messages[r.PathValue("id")]
		if limit, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && limit < len(list) {
			list = list[len(list)-limit:]
		}
		_ = json.NewEncoder(w).Encode(list)
	})
	mux.HandleFunc("GET /event", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprint(w, "data: {\"id\":\"1\",\"type\":\"server.connected\",\"properties\":{}}\n\n")
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	})
	oc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, password, ok := r.BasicAuth()
		if !ok || user != domain.AgentServerUser || password != openCodePassword {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		mux.ServeHTTP(w, r)
	}))
	t.Cleanup(oc.server.Close)
	return oc
}

func (oc *openCode) port(t *testing.T) int {
	t.Helper()
	_, port, err := net.SplitHostPort(oc.server.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	n, _ := strconv.Atoi(port)
	return n
}

func (oc *openCode) conversation(id string, updated int64) {
	oc.conversationIn(id, "", updated)
}

func (oc *openCode) conversationIn(id, directory string, updated int64) {
	oc.mu.Lock()
	defer oc.mu.Unlock()
	session := map[string]any{"id": id, "time": map[string]any{"created": updated, "updated": updated}}
	if directory != "" {
		session["directory"] = directory
	}
	oc.sessions = append(oc.sessions, session)
}

// say appends a message, or replaces the one with its id, as OpenCode
// updates a message in place while it is written.
func (oc *openCode) say(conversation string, message map[string]any) {
	oc.mu.Lock()
	defer oc.mu.Unlock()
	id := message["info"].(map[string]any)["id"]
	list := oc.messages[conversation]
	for i, existing := range list {
		if existing["info"].(map[string]any)["id"] == id {
			list[i] = message
			return
		}
	}
	oc.messages[conversation] = append(list, message)
}

func userMessage(id, text string) map[string]any {
	return map[string]any{
		"info":  map[string]any{"id": id, "role": "user", "time": map[string]any{"created": 1_700_000_000_000}},
		"parts": []any{map[string]any{"id": id + "-p", "type": "text", "text": text}},
	}
}

func assistantMessage(id string, completed bool, parts ...map[string]any) map[string]any {
	when := map[string]any{"created": 1_700_000_001_000}
	if completed {
		when["completed"] = 1_700_000_009_000
	}
	list := make([]any, len(parts))
	for i, part := range parts {
		list[i] = part
	}
	return map[string]any{
		"info": map[string]any{
			"id": id, "role": "assistant", "time": when, "modelID": "claude-opus-5-5",
			"tokens": map[string]any{"input": 1200, "output": 80, "cache": map[string]any{"read": 300, "write": 0}},
		},
		"parts": list,
	}
}

func bashCall(status string) map[string]any {
	state := map[string]any{
		"status": status,
		"input":  map[string]any{"command": "pnpm test", "description": "Run the tests"},
		"time":   map[string]any{"start": 1_700_000_002_000},
	}
	if status == "completed" {
		state["output"] = "12 passed"
		state["time"] = map[string]any{"start": 1_700_000_002_000, "end": 1_700_000_003_000}
	}
	return map[string]any{"id": "prt-bash", "type": "tool", "callID": "call-1", "tool": "bash", "state": state}
}

func followOpenCode(t *testing.T, server domain.AgentServer, sink *batches) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = transcript.New(transcript.Options{}).
			Follow(ctx, domain.Session{Agent: domain.AgentOpenCode, Launch: domain.Launch{Server: &server}}, 64<<10, 256, sink.emit)
	}()
	t.Cleanup(func() { cancel(); <-done })
}

// blockOf is an entry's first content block, or its content when that is text.
func blockOf(entry map[string]any) map[string]any {
	message, _ := entry["message"].(map[string]any)
	if text, ok := message["content"].(string); ok {
		return map[string]any{"type": "string", "text": text}
	}
	blocks, _ := message["content"].([]any)
	if len(blocks) == 0 {
		return nil
	}
	block, _ := blocks[0].(map[string]any)
	return block
}

// An OpenCode conversation reaches the chat as the transcript lines it
// already draws: the prompt, then a call as it starts and its result as it
// ends, under the names the chat knows; a reply only once it is written.
// Regression: a call sent only once it ends (no live row), a reply sent
// half-written, or OpenCode's own tool names reaching a chat that does not
// know them.
func TestAnOpenCodeConversationReadsAsTheChatsTranscript(t *testing.T) {
	oc := newOpenCode(t)
	oc.conversation("ses_a", 1_700_000_000_000)
	oc.say("ses_a", userMessage("msg_1", "run the tests"))
	oc.say("ses_a", assistantMessage("msg_2", false,
		map[string]any{"id": "prt-think", "type": "reasoning", "text": "Tests first.", "time": map[string]any{"start": 1_700_000_001_000, "end": 1_700_000_001_500}},
		bashCall("running"),
		map[string]any{"id": "prt-reply", "type": "text", "text": "All", "time": map[string]any{"start": 1_700_000_004_000}},
	))
	sink := &batches{}
	followOpenCode(t, domain.AgentServer{Port: oc.port(t), Password: openCodePassword}, sink)

	eventually(t, "the history", func() bool { return len(sink.entries()) == 3 })
	got := sink.entries()
	if block := blockOf(got[0]); got[0]["type"] != "user" || block["text"] != "run the tests" {
		t.Fatalf("first entry = %v, want the prompt", got[0])
	}
	if block := blockOf(got[1]); block["type"] != "thinking" || block["thinking"] != "Tests first." {
		t.Fatalf("second entry = %v, want the thought", got[1])
	}
	call := blockOf(got[2])
	input, _ := call["input"].(map[string]any)
	if call["type"] != "tool_use" || call["name"] != "Bash" || call["id"] != "call-1" || input["command"] != "pnpm test" {
		t.Fatalf("third entry = %v, want the running call as Bash", got[2])
	}
	if usage, _ := got[2]["message"].(map[string]any)["usage"].(map[string]any); usage["input_tokens"] != float64(1200) || usage["cache_read_input_tokens"] != float64(300) {
		t.Fatalf("usage = %v, want OpenCode's tokens in the chat's names", usage)
	}

	oc.say("ses_a", assistantMessage("msg_2", true,
		map[string]any{"id": "prt-think", "type": "reasoning", "text": "Tests first.", "time": map[string]any{"start": 1_700_000_001_000, "end": 1_700_000_001_500}},
		bashCall("completed"),
		map[string]any{"id": "prt-reply", "type": "text", "text": "All 12 pass.", "time": map[string]any{"start": 1_700_000_004_000, "end": 1_700_000_005_000}},
	))
	eventually(t, "the result and the reply", func() bool { return len(sink.entries()) == 5 })
	got = sink.entries()
	if result := blockOf(got[3]); got[3]["type"] != "user" || result["type"] != "tool_result" || result["tool_use_id"] != "call-1" || result["content"] != "12 passed" {
		t.Fatalf("fourth entry = %v, want the call's result", got[3])
	}
	if reply := blockOf(got[4]); reply["type"] != "text" || reply["text"] != "All 12 pass." {
		t.Fatalf("fifth entry = %v, want the whole reply", got[4])
	}
	for _, batch := range sink.got[1:] {
		if batch.Reset {
			t.Fatalf("a later batch started the history over: %+v", sink.got)
		}
	}
}

// OpenCode's edits name their file and text its own way; the chat reads
// Claude's names for the path and the line counts, and a stopped turn as
// the note it shows for one. Regression: an edit row with no file or no
// counts, or a stopped turn that spins as working forever.
func TestOpenCodeEditsAndStopsReadAsTheChatKnowsThem(t *testing.T) {
	oc := newOpenCode(t)
	oc.conversation("ses_a", 1_700_000_000_000)
	oc.say("ses_a", userMessage("msg_1", "rename it"))
	aborted := assistantMessage("msg_2", true, map[string]any{
		"id": "prt-edit", "type": "tool", "callID": "call-e", "tool": "edit",
		"state": map[string]any{
			"status": "completed", "output": "Edit applied.",
			"input": map[string]any{"filePath": "/w/a.ts", "oldString": "foo", "newString": "bar\nbaz"},
			"time":  map[string]any{"start": 1_700_000_002_000, "end": 1_700_000_003_000},
		},
	})
	aborted["info"].(map[string]any)["error"] = map[string]any{"name": "MessageAbortedError", "data": map[string]any{"message": "aborted"}}
	oc.say("ses_a", aborted)
	sink := &batches{}
	followOpenCode(t, domain.AgentServer{Port: oc.port(t), Password: openCodePassword}, sink)

	eventually(t, "the edit and the stop", func() bool { return len(sink.entries()) == 4 })
	got := sink.entries()
	edit := blockOf(got[1])
	input, _ := edit["input"].(map[string]any)
	if edit["name"] != "Edit" || input["file_path"] != "/w/a.ts" || input["old_string"] != "foo" || input["new_string"] != "bar\nbaz" {
		t.Fatalf("edit = %v, want Claude's names for its fields", edit)
	}
	if stop := blockOf(got[3]); got[3]["type"] != "user" || stop["text"] != "[Request interrupted by user]" {
		t.Fatalf("last entry = %v, want the interrupted note", got[3])
	}
}

// The session's conversation is the newest one touched since it launched,
// and `/new` in the TUI moves the chat to the new one from its top. An older
// conversation in the same folder is never shown as this session's.
// Regression: a session opened in a folder with history showing someone
// else's conversation, or `/new` appending to the old one.
func TestTheChatFollowsTheSessionsNewestOpenCodeConversation(t *testing.T) {
	oc := newOpenCode(t)
	oc.conversation("ses_old", 1_600_000_000_000)
	oc.say("ses_old", userMessage("msg_0", "an older conversation"))
	sink := &batches{}
	followOpenCode(t, domain.AgentServer{Port: oc.port(t), Password: openCodePassword, Since: 1_700_000_000_000}, sink)

	eventually(t, "the empty history", func() bool {
		sink.mu.Lock()
		defer sink.mu.Unlock()
		return len(sink.got) > 0
	})
	if got := sink.entries(); len(got) != 0 {
		t.Fatalf("entries = %v, want none from a conversation older than the session", got)
	}

	oc.conversation("ses_new", 1_700_000_100_000)
	oc.say("ses_new", userMessage("msg_9", "a fresh start"))
	eventually(t, "the new conversation", func() bool {
		got := sink.entries()
		return len(got) == 1 && blockOf(got[0])["text"] == "a fresh start"
	})
}

// The API is the session's alone: a follower without its password reads
// nothing. Regression: an OpenCode launched without its password, which any
// account on the host could drive.
func TestOpenCodesAPIIsReadWithTheSessionsPassword(t *testing.T) {
	oc := newOpenCode(t)
	oc.conversation("ses_a", 1_700_000_000_000)
	oc.say("ses_a", userMessage("msg_1", "secret work"))
	sink := &batches{}
	followOpenCode(t, domain.AgentServer{Port: oc.port(t), Password: "wrong"}, sink)
	followOpenCode(t, domain.AgentServer{Port: oc.port(t), Password: openCodePassword}, &batches{})

	eventually(t, "the right password's read", func() bool {
		oc.mu.Lock()
		defer oc.mu.Unlock()
		return oc.reads > 0
	})
	if got := sink.entries(); len(got) != 0 {
		t.Fatalf("entries = %v, want none without the password", got)
	}
}

// A conversation longer than one check's window arrives whole, and what is
// said after it arrives once, without the history starting over.
// Regression: a reconnect that shows only the last few messages, or a
// window read that sends the history again.
func TestALongOpenCodeConversationArrivesWholeAndThenGrows(t *testing.T) {
	oc := newOpenCode(t)
	oc.conversation("ses_a", 1_700_000_000_000)
	for i := range 30 {
		oc.say("ses_a", userMessage(fmt.Sprintf("msg_%03d", i), fmt.Sprintf("prompt %d", i)))
	}
	sink := &batches{}
	followOpenCode(t, domain.AgentServer{Port: oc.port(t), Password: openCodePassword}, sink)
	eventually(t, "the whole history", func() bool { return len(sink.entries()) == 30 })

	oc.say("ses_a", userMessage("msg_100", "one more"))
	eventually(t, "the new prompt", func() bool { return len(sink.entries()) == 31 })
	got := sink.entries()
	if blockOf(got[0])["text"] != "prompt 0" || blockOf(got[30])["text"] != "one more" {
		t.Fatalf("entries run from %v to %v, want the first prompt to the newest", got[0], got[30])
	}
}

// OpenCode keeps one store for a repository, so another session's worktree
// of the same repository lists its conversations beside this one's: the
// chat asks for its own directory's, and leaves out any other it is given.
// Regression: a pane that jumps to whichever worktree's agent wrote last.
func TestTheChatFollowsOnlyTheConversationsInTheSessionsDirectory(t *testing.T) {
	oc := newOpenCode(t)
	mine, theirs := t.TempDir(), t.TempDir()
	oc.conversationIn("ses_mine", mine, 1_700_000_000_000)
	oc.say("ses_mine", userMessage("msg_1", "in my worktree"))
	oc.conversationIn("ses_theirs", theirs, 1_700_000_500_000)
	oc.say("ses_theirs", userMessage("msg_2", "in another worktree"))
	sink := &batches{}
	followOpenCode(t, domain.AgentServer{Port: oc.port(t), Password: openCodePassword, Directory: mine}, sink)

	eventually(t, "this session's conversation", func() bool {
		got := sink.entries()
		return len(got) == 1 && blockOf(got[0])["text"] == "in my worktree"
	})
	oc.mu.Lock()
	asked := oc.asked
	oc.mu.Unlock()
	if asked != mine {
		t.Fatalf("listed the conversations of %q, want the session's directory %q", asked, mine)
	}
}
