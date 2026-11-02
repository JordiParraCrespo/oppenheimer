package transcript

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const (
	// followEvery is how often a followed transcript is checked for new
	// lines. The CLI appends a line per message and per tool result, so a
	// chat view a fraction of a second behind the terminal reads as live.
	followEvery = 300 * time.Millisecond
	// followReadMax bounds one check's read, so a long history arrives over
	// several checks instead of all at once.
	followReadMax = 4 << 20
	// chatBatchBytes keeps one batch well under the link's frame limit: the
	// batch rides the control queue, ahead of every pane's output.
	chatBatchBytes = 128 << 10
)

// Follow implements app.Transcripts: it sends the conversation's chat
// entries to emit until ctx ends — the history first, under Reset, then each
// line as the CLI appends it. OpenCode's conversation is read through its
// own API instead (`opencode.go`). A batch emit refuses (the link's queue is full)
// is offered again on the next check, so nothing is skipped.
func (r *Reader) Follow(ctx context.Context, session domain.Session, entryMax, batchMax int, emit func(app.ChatBatch) error) error {
	if session.Agent.ServesConversation() {
		if session.Launch.Server == nil {
			return app.ErrNoChat
		}
		followOpenCode(ctx, *session.Launch.Server, entryMax, batchMax, emit)
		return nil
	}
	source, ok := r.chats[session.Agent]
	if !ok {
		return app.ErrNoChat
	}
	find, ok := source.finder(session)
	if !ok {
		return app.ErrNoChat
	}
	f := &follower{
		find: find, fresh: source.transcriber,
		entryMax: entryMax, batchMax: batchMax, emit: emit, reset: true,
	}
	f.t = f.fresh()
	if r.statusDir != "" && session.Agent == domain.AgentClaude {
		f.status = statusPath(r.statusDir, session.Launch.Conversation)
	}
	ticker := time.NewTicker(followEvery)
	defer ticker.Stop()
	for {
		f.check()
		f.checkStatus()
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
		}
	}
}

// chatSource is where an agent keeps a session's conversation as a file the
// chat follows, and how the file's lines read as the chat's entries. Claude
// Code's (`claude.go`), Codex's (`codex.go`) and Grok's (`grok.go`).
type chatSource interface {
	// finder is how the session's file is found, asked at each check: its
	// path, or "" while there is none yet. False when this session can have
	// none (a conversation with no name to find it by).
	finder(session domain.Session) (func() string, bool)
	// transcriber reads one file from its start; a new one is made each time
	// the history starts over.
	transcriber() chatTranscriber
}

// chatTranscriber turns a conversation file's lines into the chat's entries,
// each the JSON of one line of the transcript the console reads (Claude
// Code's shape, `claude_chat.go`).
type chatTranscriber interface {
	// line is the entries one complete line stands for: none, one or several.
	line(line []byte, max int) [][]byte
	// quiet is what the transcriber still holds once the file has not grown
	// for since: a reply an agent writes in pieces is whole only when the
	// pieces stop.
	quiet(since time.Duration, max int) [][]byte
}

// lineByLine is the transcriber of a file whose every line is complete and
// stands for at most one entry.
type lineByLine func(line []byte, max int) ([]byte, bool)

func (l lineByLine) line(raw []byte, max int) [][]byte {
	if entry, ok := l(raw, max); ok {
		return [][]byte{entry}
	}
	return nil
}

func (lineByLine) quiet(time.Duration, int) [][]byte { return nil }

// follower is one conversation's read position.
type follower struct {
	find  func() string
	fresh func() chatTranscriber
	t     chatTranscriber
	// grew is when the file last grew, for what the transcriber holds back.
	grew     time.Time
	entryMax int
	batchMax int
	emit     func(app.ChatBatch) error

	path    string
	offset  int64
	partial []byte
	// pending is a batch emit refused, offered again before anything newer.
	pending []string
	// reset is owed to the next batch: the history starts (again) with it.
	reset bool

	// status is the conversation's status file, and statusSeen the version of
	// it last sent; an empty path follows none.
	status     string
	statusSeen statusVersion
}

// statusVersion tells one write of a status file from the next.
type statusVersion struct {
	mod  time.Time
	size int64
}

// checkStatus sends the conversation's status once it has changed, as an
// entry of its own after the history, so a reconnect's reset never drops
// it and the console always holds the latest one. A batch the link refuses
// is offered again on the next check.
func (f *follower) checkStatus() {
	if f.status == "" || f.reset || len(f.pending) > 0 {
		return
	}
	info, err := os.Stat(f.status)
	if err != nil || info.Size() > statusEntryMax {
		return
	}
	seen := statusVersion{mod: info.ModTime(), size: info.Size()}
	if seen == f.statusSeen {
		return
	}
	entry, err := os.ReadFile(f.status)
	if err != nil || !json.Valid(entry) {
		return
	}
	if f.emit(app.ChatBatch{Entries: []string{string(entry)}}) == nil {
		f.statusSeen = seen
	}
}

func (f *follower) check() {
	if len(f.pending) > 0 && !f.flush() {
		return
	}
	path := f.find()
	if path == "" {
		// Nothing written yet: say so once, so the view can wait for it.
		if f.reset && f.path == "" && f.emit(app.ChatBatch{Reset: true}) == nil {
			f.reset = false
			f.path = "-"
		}
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		return
	}
	if path != f.path || info.Size() < f.offset {
		// A new file, or one that shrank: the CLI replaced it, so the
		// history is read again from its start.
		f.path, f.offset, f.partial, f.reset = path, 0, nil, true
		f.t = f.fresh()
	}
	if info.Size() == f.offset {
		if !f.reset {
			f.queue(f.t.quiet(time.Since(f.grew), f.entryMax))
		}
		f.flush()
		return
	}
	file, err := os.Open(path) //nolint:gosec // a conversation file found under Claude Code's own folder, its name checked by conversationPattern
	if err != nil {
		return
	}
	defer func() { _ = file.Close() }()
	if _, err := file.Seek(f.offset, io.SeekStart); err != nil {
		return
	}
	chunk, err := io.ReadAll(io.LimitReader(file, followReadMax))
	if err != nil && !errors.Is(err, io.EOF) {
		return
	}
	f.offset += int64(len(chunk))
	f.grew = time.Now()
	data := append(append([]byte(nil), f.partial...), chunk...)
	end := bytes.LastIndexByte(data, '\n')
	if end < 0 {
		// A line still being written is left for the next check.
		f.partial = data
		if f.reset {
			f.flush()
		}
		return
	}
	f.partial = append([]byte(nil), data[end+1:]...)
	for _, line := range bytes.Split(data[:end], []byte{'\n'}) {
		f.queue(f.t.line(line, f.entryMax))
	}
	f.flush()
}

// queue holds entries for the next batch, leaving out one over entryMax.
func (f *follower) queue(entries [][]byte) {
	for _, entry := range entries {
		if len(entry) <= f.entryMax {
			f.pending = append(f.pending, string(entry))
		}
	}
}

// flush emits the pending entries in batches, and reports whether all of
// them left.
func (f *follower) flush() bool {
	for len(f.pending) > 0 || f.reset {
		n, size := 0, 0
		for n < len(f.pending) && n < f.batchMax && (n == 0 || size+len(f.pending[n]) <= chatBatchBytes) {
			size += len(f.pending[n])
			n++
		}
		if err := f.emit(app.ChatBatch{Reset: f.reset, Entries: f.pending[:n]}); err != nil {
			return false
		}
		f.pending, f.reset = f.pending[n:], false
	}
	f.pending = nil
	return true
}
