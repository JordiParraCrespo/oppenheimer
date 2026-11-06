package transcript

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Codex runs each subagent (`spawn_agent`) as a thread of its own, kept as a
// rollout like any other, filed by the day it started. Its first line,
// `session_meta`, names the thread that started it (`parent_thread_id`, and
// under `source.subagent.thread_spawn` its nickname, role and path among the
// agents), which is how a conversation's subagents are found: the rollouts
// whose parent is the conversation's thread, or one of its subagents'.
// Nothing in a subagent's rollout names the call that started it; the
// parent's `spawn_agent` answers with the new thread's id (`agent_id`) or,
// in Codex's second version, the task's name, the last part of its path,
// and the console matches the call by that. A subagent's turns start and
// end as `task_started` and `task_complete`, and a stop as `turn_aborted`.
// Read off Codex's own protocol (`codex-rs/protocol`, `rollout/src/policy.rs`).

// codexHeads holds the first lines of the rollouts read, each read once,
// shared by every follower on the host.
type codexHeads struct {
	mu    sync.Mutex
	heads map[string]codexHead
}

func newCodexHeads() *codexHeads { return &codexHeads{heads: map[string]codexHead{}} }

// of is the rollout's head, read the first time it is asked for; false
// while its first line is not there yet.
func (h *codexHeads) of(path string) (codexHead, bool) {
	h.mu.Lock()
	head, ok := h.heads[path]
	h.mu.Unlock()
	if ok {
		return head, true
	}
	head, ok = codexHeadOf(path)
	if !ok {
		return codexHead{}, false
	}
	h.mu.Lock()
	h.heads[path] = head
	h.mu.Unlock()
	return head, true
}

var _ subagentSource = codexSource{}

// subagents implements subagentSource: the rollouts filed from the day the
// conversation's own was to now whose thread descends from it.
func (c codexSource) subagents(main string) []subagentFile {
	if c.heads == nil {
		return nil
	}
	root, ok := c.heads.of(main)
	if !ok || root.ID == "" {
		return nil
	}
	from, ok := codexDay(c.sessions, main)
	if !ok {
		return nil
	}
	now := time.Now()
	if earliest := now.AddDate(0, 0, -codexScanDays); from.Before(earliest) {
		from = midnight(earliest)
	}
	type child struct {
		path string
		head codexHead
	}
	var all []child
	for day := from; !day.After(now.Add(24 * time.Hour)); day = day.AddDate(0, 0, 1) {
		folder := filepath.Join(c.sessions, day.Format("2006"), day.Format("01"), day.Format("02"))
		items, err := os.ReadDir(folder)
		if err != nil {
			continue
		}
		for _, item := range items {
			name := item.Name()
			path := filepath.Join(folder, name)
			if path == main || !strings.HasPrefix(name, "rollout-") || !strings.HasSuffix(name, ".jsonl") {
				continue
			}
			head, ok := c.heads.of(path)
			if ok && head.child() && head.ID != "" {
				all = append(all, child{path, head})
			}
		}
	}
	// The conversation's own, then theirs, as deep as they go.
	ours := map[string]bool{root.ID: true}
	var files []subagentFile
	for grew := true; grew; {
		grew = false
		for _, ch := range all {
			if ours[ch.head.ID] || !ours[ch.head.parent()] {
				continue
			}
			ours[ch.head.ID], grew = true, true
			meta := subagentMeta{ID: ch.head.ID}
			if spawn := ch.head.spawn(); spawn != nil {
				meta.Path, meta.Name, meta.AgentType = spawn.AgentPath, spawn.AgentNickname, spawn.AgentRole
			}
			files = append(files, subagentFile{path: ch.path, meta: meta})
		}
	}
	return files
}

// codexDay is the day a rollout is filed under, off its folders.
func codexDay(root, path string) (time.Time, bool) {
	rel, err := filepath.Rel(root, filepath.Dir(path))
	if err != nil {
		return time.Time{}, false
	}
	day, err := time.ParseInLocation("2006/01/02", filepath.ToSlash(rel), time.Local)
	if err != nil {
		return time.Time{}, false
	}
	return day, true
}

// subagentLine implements subagentSource: a turn starting or ending, and the
// tokens its context held.
func (codexSource) subagentLine(raw []byte) (string, int64) {
	var line codexLine
	if json.Unmarshal(raw, &line) != nil || line.Type != "event_msg" {
		return "", 0
	}
	var p codexPayload
	if json.Unmarshal(line.Payload, &p) != nil {
		return "", 0
	}
	switch p.Type {
	case "task_started", "turn_started":
		return subagentRunning, 0
	case "task_complete", "turn_complete":
		return subagentCompleted, 0
	case "turn_aborted":
		return subagentStopped, 0
	case "token_count":
		if p.Info != nil && p.Info.LastTokenUsage != nil {
			usage := p.Info.LastTokenUsage
			if usage.TotalTokens > 0 {
				return "", usage.TotalTokens
			}
			return "", usage.InputTokens + usage.OutputTokens
		}
	}
	return "", 0
}
