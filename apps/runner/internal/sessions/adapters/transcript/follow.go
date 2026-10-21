package transcript

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
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
	if _, ok := r.agents[agent]; !ok || agent != domain.AgentClaude || !conversationPattern.MatchString(conversation) {
		return app.ErrNoChat
	}
	reader := r.agents[agent].(claudeReader)
	f := &follower{find: func() string {
		matches, _ := filepath.Glob(filepath.Join(reader.projects, "*", conversation+".jsonl"))
		return newest(matches)
	}, entryMax: entryMax, batchMax: batchMax, emit: emit, reset: true}
	ticker := time.NewTicker(followEvery)
	defer ticker.Stop()
	for {
		f.check()
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
		entry, ok := compactClaude(line)
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
