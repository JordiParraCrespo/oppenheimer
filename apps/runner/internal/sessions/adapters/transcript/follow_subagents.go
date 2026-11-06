package transcript

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"slices"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// SubagentEntryType names the chat entry that says what one subagent is: the
// call that started it, what kind of agent it is, and how it stands. Its
// own lines follow as the transcript's lines do, each marked `isSidechain`
// and carrying the subagent's id (`agentId`), so the console can hang its
// work under the call that started it whatever order they arrive in.
const SubagentEntryType = "oppenheimer.subagent"

// The states a subagent entry carries.
const (
	subagentRunning   = "running"
	subagentCompleted = "completed"
	subagentFailed    = "failed"
	subagentStopped   = "stopped"
)

const (
	// subagentListEvery is how often a conversation's subagents are listed
	// again; their files are read at every check once listed.
	subagentListEvery = time.Second
	// subagentsMax bounds how many subagents one conversation follows, the
	// newest ones, so a session that has run hundreds sends what matters.
	subagentsMax = 64
	// subagentHistoryMax bounds how much of a subagent's file an attachment
	// sends of what it did before: its tail, from a line's start.
	subagentHistoryMax = 512 << 10
)

// subagentSource is a chatSource whose conversations run subagents that
// keep files of their own: Claude Code's (`claude_subagents.go`) and
// Codex's (`codex_subagents.go`).
type subagentSource interface {
	// subagents lists the subagents of the conversation kept at main, the
	// path the follower is reading.
	subagents(main string) []subagentFile
	// subagentLine reads one line of a subagent's file for what it says of
	// the subagent: a state, "" for none, and the tokens its context held,
	// 0 for no count.
	subagentLine(line []byte) (state string, tokens int64)
}

// subagentFile is one subagent as its listing found it.
type subagentFile struct {
	path string
	// meta is what is known of it without reading its lines; State is ""
	// when only its lines tell.
	meta subagentMeta
}

// subagentMeta is the subagent entry the console reads.
type subagentMeta struct {
	Type string `json:"type"`
	// ID is the subagent's own id: Claude Code's agent id, Codex's thread.
	ID string `json:"id"`
	// ParentToolUseID is the call that started it, when its files say;
	// otherwise the console matches the call by what its output names
	// (Codex's `spawn_agent` answers with the thread or the task's name).
	ParentToolUseID string `json:"parentToolUseId,omitempty"`
	// Path is where it sits among the agents (Codex's `/root/explorer`).
	Path string `json:"path,omitempty"`
	// AgentType is its kind (`Explore`, `general-purpose`, a Codex role).
	AgentType   string `json:"agentType,omitempty"`
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
	Model       string `json:"model,omitempty"`
	State       string `json:"state,omitempty"`
	// Tokens is what its context held at its last answer, when counted.
	Tokens int64 `json:"tokens,omitempty"`
}

// subagentFollower is where one conversation's subagents have been read to.
type subagentFollower struct {
	source subagentSource
	fresh  func() chatTranscriber
	listed time.Time
	main   string
	files  map[string]*subagentRead
}

// subagentRead is one subagent's read position, and what was last sent of it.
type subagentRead struct {
	file    subagentFile
	t       chatTranscriber
	offset  int64
	partial []byte
	read    bool
	state   string
	tokens  int64
	sent    []byte
	mod     time.Time
}

func newSubagentFollower(source subagentSource, fresh func() chatTranscriber) *subagentFollower {
	return &subagentFollower{source: source, fresh: fresh, files: map[string]*subagentRead{}}
}

// checkSubagents sends what each subagent wrote since the last check, and
// its entry whenever what it says changed, after the history as the status
// is. The lines read are only taken as sent once the link took them: a
// batch the link refuses is read again on the next check.
func (f *follower) checkSubagents() {
	s := f.subs
	if s == nil || f.history != historySent || len(f.pending) > 0 || f.path == "" || f.path == "-" {
		return
	}
	if s.main != f.path {
		// Another conversation: its subagents are its own.
		s.main, s.files, s.listed = f.path, map[string]*subagentRead{}, time.Time{}
	}
	if time.Since(s.listed) >= subagentListEvery {
		s.listed = time.Now()
		s.list()
	}
	for _, read := range s.ordered() {
		entries, done := s.read(read, f.entryMax)
		if len(entries) == 0 {
			continue
		}
		if !f.emitAll(entries) {
			return
		}
		done()
	}
}

// list takes the newest subagents the source finds, keeping the read
// positions of those already followed.
func (s *subagentFollower) list() {
	files := s.source.subagents(s.main)
	type found struct {
		file subagentFile
		mod  time.Time
	}
	all := make([]found, 0, len(files))
	for _, file := range files {
		info, err := os.Stat(file.path)
		if err != nil {
			continue
		}
		all = append(all, found{file, info.ModTime()})
	}
	slices.SortFunc(all, func(a, b found) int { return b.mod.Compare(a.mod) })
	if len(all) > subagentsMax {
		all = all[:subagentsMax]
	}
	for _, f := range all {
		if read, ok := s.files[f.file.meta.ID]; ok {
			read.file, read.mod = f.file, f.mod
			continue
		}
		s.files[f.file.meta.ID] = &subagentRead{file: f.file, t: s.fresh(), mod: f.mod}
	}
}

// ordered is the subagents oldest first, so the console meets them in the
// order they started.
func (s *subagentFollower) ordered() []*subagentRead {
	reads := make([]*subagentRead, 0, len(s.files))
	for _, read := range s.files {
		reads = append(reads, read)
	}
	slices.SortFunc(reads, func(a, b *subagentRead) int {
		if c := a.mod.Compare(b.mod); c != 0 {
			return c
		}
		return bytes.Compare([]byte(a.file.meta.ID), []byte(b.file.meta.ID))
	})
	return reads
}

// read is what one subagent has to send: its new lines as entries marked
// as its own, then its entry when what it says changed; and the function
// that takes them as sent.
func (s *subagentFollower) read(r *subagentRead, max int) ([]string, func()) {
	info, err := os.Stat(r.file.path)
	if err != nil {
		return nil, nil
	}
	offset, partial, state, tokens := r.offset, r.partial, r.state, r.tokens
	if info.Size() < offset {
		// Replaced: read again from its start.
		offset, partial, r.t = 0, nil, s.fresh()
	}
	if !r.read && info.Size() > subagentHistoryMax {
		start, err := lineAfter(r.file.path, info.Size()-subagentHistoryMax)
		if err != nil {
			return nil, nil
		}
		offset = start
	}
	var entries []string
	if info.Size() > offset {
		chunk, err := readFrom(r.file.path, offset, followReadMax)
		if err != nil {
			return nil, nil
		}
		offset += int64(len(chunk))
		data := append(append([]byte(nil), partial...), chunk...)
		end := bytes.LastIndexByte(data, '\n')
		if end < 0 {
			partial = data
		} else {
			partial = append([]byte(nil), data[end+1:]...)
			for _, line := range bytes.Split(data[:end], []byte{'\n'}) {
				if st, n := s.source.subagentLine(line); st != "" || n > 0 {
					if st != "" {
						state = st
					}
					if n > 0 {
						tokens = n
					}
				}
				for _, entry := range r.t.line(line, max) {
					if tagged, ok := sidechainEntry(entry, r.file.meta.ID, max); ok {
						entries = append(entries, string(tagged))
					}
				}
			}
		}
	}
	meta := r.file.meta
	meta.Type = SubagentEntryType
	if meta.State == "" {
		meta.State = state
	}
	if meta.State == "" {
		meta.State = subagentRunning
	}
	if meta.Tokens == 0 {
		meta.Tokens = tokens
	}
	encoded, err := json.Marshal(meta)
	if err != nil {
		return nil, nil
	}
	changed := !bytes.Equal(encoded, r.sent)
	if changed {
		// The entry goes first, so its lines never wait for it to be read.
		entries = append([]string{string(encoded)}, entries...)
	}
	return entries, func() {
		r.offset, r.partial, r.state, r.tokens, r.read = offset, partial, state, tokens, true
		if changed {
			r.sent = encoded
		}
	}
}

// emitAll sends entries in batches; whether every one left.
func (f *follower) emitAll(entries []string) bool {
	for len(entries) > 0 {
		n, size := 0, 0
		for n < len(entries) && n < f.batchMax && (n == 0 || size+len(entries[n]) <= chatBatchBytes) {
			size += len(entries[n])
			n++
		}
		if f.emit(app.ChatBatch{Entries: entries[:n]}) != nil {
			return false
		}
		entries = entries[n:]
	}
	return true
}

// sidechainEntry marks one of a subagent's entries as its own, or reports
// none for an entry that is not a line of its conversation (a status, which
// would read as the session's own) or that the mark takes over max.
func sidechainEntry(entry []byte, id string, max int) ([]byte, bool) {
	var head struct {
		Type string `json:"type"`
	}
	if json.Unmarshal(entry, &head) != nil || (head.Type != "user" && head.Type != "assistant") {
		return nil, false
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(entry, &fields) != nil {
		return nil, false
	}
	fields["isSidechain"] = json.RawMessage("true")
	agent, err := json.Marshal(id)
	if err != nil {
		return nil, false
	}
	fields["agentId"] = agent
	tagged, err := json.Marshal(fields)
	if err != nil || len(tagged) > max {
		return nil, false
	}
	return tagged, true
}

// readFrom reads at most max bytes of the file at path from offset.
func readFrom(path string, offset int64, max int64) ([]byte, error) {
	file, err := os.Open(path) //nolint:gosec // a subagent's file, listed under the agent's own folder
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()
	if _, err := file.Seek(offset, io.SeekStart); err != nil {
		return nil, err
	}
	chunk, err := io.ReadAll(io.LimitReader(file, max))
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}
	return chunk, nil
}

// lineAfter is where the first line that starts at or after from starts.
func lineAfter(path string, from int64) (int64, error) {
	chunk, err := readFrom(path, from, 1<<20)
	if err != nil {
		return 0, err
	}
	at := bytes.IndexByte(chunk, '\n')
	if at < 0 {
		return from + int64(len(chunk)), nil
	}
	return from + int64(at) + 1, nil
}
