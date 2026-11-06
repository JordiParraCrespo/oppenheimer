package transcript_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/transcript"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// subagentEntries are the subagent entries received, by subagent, the last
// of each; and the lines that are a subagent's own, by subagent.
func subagentEntries(sink *batches) (map[string]map[string]any, map[string][]map[string]any) {
	metas, lines := map[string]map[string]any{}, map[string][]map[string]any{}
	for _, entry := range sink.entries() {
		if entry["type"] == transcript.SubagentEntryType {
			metas[entry["id"].(string)] = entry
			continue
		}
		if entry["isSidechain"] == true {
			id, _ := entry["agentId"].(string)
			lines[id] = append(lines[id], entry)
		}
	}
	return metas, lines
}

// A Claude Code subagent keeps its conversation in a file of its own beside
// the session's, and the chat follows it there: the subagent's entry names
// the `Agent` call that started it, its kind and its task, and says it runs
// until its meta says it finished; each line it writes arrives marked as its
// own, after the session's history. A subagent with no meta yet waits, since
// nothing else says which call it belongs to. Regression: a subagent's work
// never reached the chat, which showed only its call and, at the end, its
// answer (the files are Claude Code 2.1's, read off its own folder).
func TestAClaudeCodeSubagentsWorkReachesTheChatUnderItsCall(t *testing.T) {
	projects := write(t, snapshotLine, promptLine,
		`{"type":"assistant","uuid":"a-1","message":{"role":"assistant","content":[{"type":"tool_use","id":"toolu_agent","name":"Agent","input":{"description":"Find the picker","subagent_type":"Explore","prompt":"Where is the repo picker?"}}]}}`)
	dir := filepath.Join(projects, "-w-sessions-bold-otter-3f9a7k-oppenheimer", conversation, "subagents")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	child := filepath.Join(dir, "agent-aefc16f829bffe71f.jsonl")
	meta := filepath.Join(dir, "agent-aefc16f829bffe71f.meta.json")
	writeFile(t, child,
		`{"type":"user","isSidechain":true,"agentId":"aefc16f829bffe71f","uuid":"s-1","message":{"role":"user","content":"Where is the repo picker?"}}`,
		`{"type":"attachment","isSidechain":true,"agentId":"aefc16f829bffe71f","attachment":{"type":"date"}}`,
		`{"type":"assistant","isSidechain":true,"agentId":"aefc16f829bffe71f","uuid":"s-2","message":{"role":"assistant","model":"claude-haiku-5-5","content":[{"type":"tool_use","id":"toolu_grep","name":"Grep","input":{"pattern":"RepoPicker"}}]}}`)
	// A second subagent with no meta yet.
	writeFile(t, filepath.Join(dir, "agent-b2.jsonl"),
		`{"type":"user","isSidechain":true,"agentId":"b2","message":{"role":"user","content":"Too soon"}}`)
	writeFile(t, meta, `{"agentType":"Explore","description":"Find the picker","toolUseId":"toolu_agent","spawnDepth":1,"finished":false}`)

	sink := &batches{}
	follow(t, projects, sink)
	eventually(t, "the subagent's lines", func() bool {
		_, lines := subagentEntries(sink)
		return len(lines["aefc16f829bffe71f"]) == 2
	})
	metas, lines := subagentEntries(sink)
	got := metas["aefc16f829bffe71f"]
	if got["parentToolUseId"] != "toolu_agent" || got["agentType"] != "Explore" || got["description"] != "Find the picker" || got["state"] != "running" {
		t.Fatalf("subagent entry = %v, want its call, kind, task and running", got)
	}
	if _, ok := metas["b2"]; ok || len(lines["b2"]) > 0 {
		t.Fatal("a subagent with no meta was sent")
	}
	if call := blockOf(lines["aefc16f829bffe71f"][1]); call["name"] != "Grep" {
		t.Fatalf("the subagent's call = %v", call)
	}
	for _, entry := range sink.entries()[:2] {
		if entry["isSidechain"] == true || entry["type"] == transcript.SubagentEntryType {
			t.Fatal("a subagent's entry came before the session's own history")
		}
	}

	appendLines(t, child, `{"type":"user","isSidechain":true,"agentId":"aefc16f829bffe71f","uuid":"s-3","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_grep","content":"src/repo-picker.tsx"}]}}`)
	writeFile(t, meta, `{"agentType":"Explore","description":"Find the picker","toolUseId":"toolu_agent","spawnDepth":1,"finished":true}`)
	eventually(t, "the subagent's end", func() bool {
		metas, lines := subagentEntries(sink)
		return metas["aefc16f829bffe71f"]["state"] == "completed" && len(lines["aefc16f829bffe71f"]) == 3
	})
}

// A Codex subagent is a thread with a rollout of its own, in the session's
// directory: it is followed as the session's subagent, never taken for the
// session's own conversation however new it is, with its nickname, role
// and path as Codex named them and its state off its turns, and a thread it
// started in turn is the session's too. Regressions: a spawned agent's
// rollout, newer than the session's, took over the session's Chat tab; and
// the session's own rollout, whose `source` is a word (`"cli"`) where a
// subagent's is an object, failed to read and left the Chat tab empty.
func TestACodexSubagentsRolloutIsFollowedAsTheSessionsSubagent(t *testing.T) {
	sessions, worktree := t.TempDir(), t.TempDir()
	created := time.Now().Add(-time.Minute)
	writeRollout(t, sessions, "main", time.Now().Add(-10*time.Second),
		// A conversation of its own names its source as a word, a subagent's as an object.
		rolloutLine("session_meta", map[string]any{"id": "thr-main", "cwd": worktree, "source": "cli"}),
		rolloutLine("event_msg", map[string]any{"type": "user_message", "message": "Review the wallet"}),
		rolloutLine("response_item", map[string]any{"type": "function_call", "name": "spawn_agent", "call_id": "call_spawn",
			"arguments": `{"message":"Read the tests","agent_type":"explorer"}`}),
		rolloutLine("response_item", map[string]any{"type": "function_call_output", "call_id": "call_spawn",
			"output": `{"agent_id":"thr-child","nickname":"Ada"}`}))
	spawned := func(id, parent string) map[string]any {
		return map[string]any{"id": id, "cwd": worktree, "parent_thread_id": parent, "source": map[string]any{
			"subagent": map[string]any{"thread_spawn": map[string]any{
				"parent_thread_id": parent, "depth": 1, "agent_path": "/root/" + id, "agent_nickname": "Ada", "agent_role": "explorer",
			}},
		}}
	}
	child := writeRollout(t, sessions, "child", time.Now(),
		rolloutLine("session_meta", spawned("thr-child", "thr-main")),
		rolloutLine("event_msg", map[string]any{"type": "task_started"}),
		rolloutLine("response_item", map[string]any{"type": "function_call", "name": "exec_command", "call_id": "call_rg",
			"arguments": `{"cmd":"rg wallet"}`}),
		rolloutLine("event_msg", map[string]any{"type": "token_count",
			"info": map[string]any{"last_token_usage": map[string]any{"total_tokens": 31000}, "model_context_window": 270000}}))
	writeRollout(t, sessions, "grandchild", time.Now(), rolloutLine("session_meta", spawned("thr-grandchild", "thr-child")))
	writeRollout(t, sessions, "stranger", time.Now(), rolloutLine("session_meta", spawned("thr-stranger", "thr-other")))

	sink := &batches{}
	followSession(t, transcript.Options{CodexSessions: sessions},
		domain.Session{Agent: domain.AgentCodex, Worktree: worktree, Created: created}, sink)
	eventually(t, "the subagent", func() bool {
		metas, lines := subagentEntries(sink)
		return metas["thr-child"]["tokens"] == float64(31000) && len(lines["thr-child"]) == 1
	})
	if prompt := blockOf(sink.entries()[0]); prompt["text"] != "Review the wallet" {
		t.Fatalf("the session's chat starts with %v, want its own prompt", prompt)
	}
	metas, lines := subagentEntries(sink)
	got := metas["thr-child"]
	if got["name"] != "Ada" || got["agentType"] != "explorer" || got["path"] != "/root/thr-child" || got["state"] != "running" {
		t.Fatalf("subagent entry = %v", got)
	}
	if status := lines["thr-child"][0]; blockOf(status)["name"] != "Bash" {
		t.Fatalf("the subagent's line = %v, want its command (and never its status)", status)
	}
	if _, ok := metas["thr-grandchild"]; !ok {
		t.Fatal("a subagent's own subagent was not followed")
	}
	if _, ok := metas["thr-stranger"]; ok {
		t.Fatal("another conversation's subagent was followed")
	}

	appendLines(t, child, rolloutLine("event_msg", map[string]any{"type": "task_complete"}))
	eventually(t, "the subagent's end", func() bool {
		metas, _ := subagentEntries(sink)
		return metas["thr-child"]["state"] == "completed"
	})
}

// OpenCode runs a subagent (`task`) in a conversation of its own, which its
// call names (`state.metadata.sessionId`): the chat reads that conversation
// through the same API while the call runs, and once more after it ends,
// each line marked as the subagent's, with its kind, task and model.
// Regression: an OpenCode subagent showed as a call with no work under it.
func TestAnOpenCodeSubagentsConversationReachesTheChatUnderItsCall(t *testing.T) {
	oc := newOpenCode(t)
	oc.conversation("ses_main", 1_700_000_000_000)
	task := func(status string) map[string]any {
		state := map[string]any{
			"status": status,
			"input":  map[string]any{"description": "Find the picker", "prompt": "Where is it?", "subagent_type": "explore"},
			"time":   map[string]any{"start": 1_700_000_002_000},
			"metadata": map[string]any{
				"parentSessionId": "ses_main", "sessionId": "ses_child",
				"model": map[string]any{"modelID": "claude-haiku-5-5", "providerID": "anthropic"},
			},
		}
		if status == "completed" {
			state["output"] = "In src/repo-picker.tsx"
		}
		return map[string]any{"id": "prt-task", "type": "tool", "callID": "call-task", "tool": "task", "state": state}
	}
	oc.say("ses_main", userMessage("msg_1", "find the picker"))
	oc.say("ses_main", assistantMessage("msg_2", false, task("running")))
	oc.say("ses_child", userMessage("msg_c1", "Where is it?"))
	sink := &batches{}
	followOpenCode(t, domain.AgentServer{Port: oc.port(t), Password: openCodePassword}, sink)

	eventually(t, "the subagent", func() bool {
		_, lines := subagentEntries(sink)
		return len(lines["ses_child"]) == 1
	})
	metas, _ := subagentEntries(sink)
	got := metas["ses_child"]
	if got["parentToolUseId"] != "call-task" || got["agentType"] != "explore" || got["model"] != "claude-haiku-5-5" || got["state"] != "running" {
		t.Fatalf("subagent entry = %v", got)
	}

	oc.say("ses_child", assistantMessage("msg_c2", true, bashCall("completed")))
	oc.say("ses_main", assistantMessage("msg_2", true, task("completed")))
	eventually(t, "the subagent's work and end", func() bool {
		metas, lines := subagentEntries(sink)
		return metas["ses_child"]["state"] == "completed" && len(lines["ses_child"]) == 3
	})
	_, lines := subagentEntries(sink)
	if call := blockOf(lines["ses_child"][1]); call["name"] != "Bash" {
		t.Fatalf("the subagent's call = %v", call)
	}
}

// A subagent's line is sent the same, byte for byte, by every attachment,
// however far into its file each starts sending, so the console holds it
// once. Regression: Codex numbers a rollout's lines, and the subagent's
// lines were numbered from where an attachment started (its tail of a long
// file, or again after a batch the link refused), so a reconnect drew a
// Codex subagent's steps twice.
func TestACodexSubagentsLineReadsTheSameToEveryAttachment(t *testing.T) {
	sessions, worktree := t.TempDir(), t.TempDir()
	created := time.Now().Add(-time.Minute)
	writeRollout(t, sessions, "main", time.Now().Add(-10*time.Second),
		rolloutLine("session_meta", map[string]any{"id": "thr-main", "cwd": worktree}),
		rolloutLine("event_msg", map[string]any{"type": "user_message", "message": "Go"}))
	reasoning := func(n int) string {
		return rolloutLine("response_item", map[string]any{"type": "reasoning", "summary": []any{
			map[string]any{"type": "summary_text", "text": strings.Repeat("x", 200<<10) + strconv.Itoa(n)},
		}})
	}
	child := writeRollout(t, sessions, "child", time.Now(),
		rolloutLine("session_meta", map[string]any{"id": "thr-child", "cwd": worktree, "parent_thread_id": "thr-main"}),
		reasoning(1), reasoning(2), reasoning(3),
		rolloutLine("response_item", map[string]any{"type": "function_call", "name": "exec_command", "call_id": "call_rg", "arguments": `{"cmd":"rg wallet"}`}))
	session := domain.Session{Agent: domain.AgentCodex, Worktree: worktree, Created: created}
	commandOf := func(sink *batches) string {
		_, lines := subagentEntries(sink)
		for _, entry := range lines["thr-child"] {
			if blockOf(entry)["name"] == "Bash" {
				raw, _ := json.Marshal(entry)
				return string(raw)
			}
		}
		return ""
	}

	first := &batches{}
	followSession(t, transcript.Options{CodexSessions: sessions}, session, first)
	eventually(t, "the first attachment's command", func() bool { return commandOf(first) != "" })
	// The file grows past the tail the first attachment started at.
	appendLines(t, child, reasoning(4), reasoning(5))
	second := &batches{}
	followSession(t, transcript.Options{CodexSessions: sessions}, session, second)
	eventually(t, "the second attachment's command", func() bool { return commandOf(second) != "" })
	if commandOf(first) != commandOf(second) {
		t.Fatalf("the same line was sent two ways:\n%s\n%s", commandOf(first), commandOf(second))
	}
}

// A subagent whose conversation OpenCode will not serve (one it deleted)
// never holds up the session's own. Regression: the refusal ended the
// whole read before anything was sent, again at each retry, and the Chat
// tab waited for a history that never came.
func TestAnOpenCodeSubagentOpenCodeWillNotServeLeavesTheChatAlone(t *testing.T) {
	oc := newOpenCode(t)
	oc.conversation("ses_main", 1_700_000_000_000)
	oc.say("ses_main", userMessage("msg_1", "find the picker"))
	oc.say("ses_main", assistantMessage("msg_2", true, map[string]any{
		"id": "prt-task", "type": "tool", "callID": "call-task", "tool": "task",
		"state": map[string]any{
			"status": "completed", "output": "done",
			"input":    map[string]any{"description": "Find it", "subagent_type": "explore"},
			"time":     map[string]any{"start": 1_700_000_002_000, "end": 1_700_000_003_000},
			"metadata": map[string]any{"sessionId": "ses_gone_child"},
		},
	}))
	sink := &batches{}
	followOpenCode(t, domain.AgentServer{Port: oc.port(t), Password: openCodePassword}, sink)
	eventually(t, "the session's own conversation", func() bool {
		for _, entry := range sink.entries() {
			if entry["isSidechain"] != true && entry["type"] == "user" && blockOf(entry)["tool_use_id"] == "call-task" {
				return true
			}
		}
		return false
	})
}

func writeFile(t *testing.T, path string, lines ...string) {
	t.Helper()
	body := ""
	for _, line := range lines {
		body += line + "\n"
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(body), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(tmp, path); err != nil {
		t.Fatal(err)
	}
}
