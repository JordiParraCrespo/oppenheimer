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
// line as the CLI appends it. A batch emit refuses (the link's queue is full)
// is offered again on the next check, so nothing is skipped.
func (r *Reader) Follow(ctx context.Context, agent domain.Agent, conversation string, entryMax, batchMax int, emit func(app.ChatBatch) error) error {
	reader, ok := r.agents[agent]
	if !ok || !conversationPattern.MatchString(conversation) {
		return app.ErrNoChat
	}
	f := &follower{
		find:     func() string { return reader.path(conversation) },
		entry:    reader.chatEntry,
		entryMax: entryMax, batchMax: batchMax, emit: emit, reset: true,
	}
	if r.statusDir != "" && agent == domain.AgentClaude {
		f.status = statusPath(r.statusDir, conversation)
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

// follower is one conversation's read position.
type follower struct {
	find     func() string
	entry    func(line []byte, max int) ([]byte, bool)
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
	}
	if info.Size() == f.offset {
		if f.reset {
			f.flush()
		}
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
		entry, ok := f.entry(line, f.entryMax)
		if !ok || len(entry) > f.entryMax {
			continue
		}
		f.pending = append(f.pending, string(entry))
	}
	f.flush()
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
