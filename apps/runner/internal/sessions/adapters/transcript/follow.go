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
		entryMax: entryMax, batchMax: batchMax, emit: emit, reset: true, history: historyComing,
	}
	f.t = f.fresh()
	if r.statusDir != "" && session.Agent == domain.AgentClaude {
		f.status = statusPath(r.statusDir, session.Launch.Conversation)
	}
	if r.filesDir != "" && conversationPattern.MatchString(session.ID) {
		f.shared, f.sharedSeen = SharedDir(r.filesDir, session.ID), map[string]bool{}
	}
	ticker := time.NewTicker(followEvery)
	defer ticker.Stop()
	for {
		f.check()
		f.checkStatus()
		f.checkShared()
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
	// holds is whether it still holds lines read for a later quiet: the
	// history has not all been sent while it does.
	holds() bool
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

func (lineByLine) holds() bool { return false }

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
	// history is how far the history a reset started has been sent: the
	// console holds a first load until it is told, since a read slowed by a
	// screenshot's preview would otherwise look like the end of it.
	history history

	// status is the conversation's status file, and statusSeen the version of
	// it last sent; an empty path follows none.
	status     string
	statusSeen statusVersion

	// shared is the session's folder of files its agent shared, and
	// sharedSeen the entries already sent from it; an empty path follows none.
	shared     string
	sharedSeen map[string]bool
}

// history is how far a follower has sent the history a reset started.
type history int

const (
	// historySent: the history is all sent; what follows is live.
	historySent history = iota
	// historyComing: more of the history is on its way.
	historyComing
	// historyRead: the last read reached the transcript's end, which the
	// next batch sent says.
	historyRead
)

// marker is what a batch says of the history, `last` when it carries the
// last of the entries pending.
func (h history) marker(last bool) string {
	switch {
	case h == historySent:
		return ""
	case h == historyRead && last:
		return app.HistoryEnd
	default:
		return app.HistoryMore
	}
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
	if f.status == "" || f.history != historySent || len(f.pending) > 0 {
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

// checkShared sends each file the agent shared that this attachment has not
// sent yet, after the history as the status is: the console places each in
// the conversation by its timestamp. A batch the link refuses is offered
// again on the next check.
func (f *follower) checkShared() {
	if f.shared == "" || f.history != historySent || len(f.pending) > 0 {
		return
	}
	entries, names := sharedEntries(f.shared, f.sharedSeen)
	for len(entries) > 0 {
		n, size := 0, 0
		for n < len(entries) && n < f.batchMax && (n == 0 || size+len(entries[n]) <= chatBatchBytes) {
			size += len(entries[n])
			n++
		}
		if f.emit(app.ChatBatch{Entries: entries[:n]}) != nil {
			return
		}
		for _, name := range names[:n] {
			f.sharedSeen[name] = true
		}
		entries, names = entries[n:], names[n:]
	}
}

func (f *follower) check() {
	if len(f.pending) > 0 && !f.flush() {
		return
	}
	path := f.find()
	if path == "" {
		// Nothing written yet: say so once, so the view can wait for it.
		if f.reset && f.path == "" && f.emit(app.ChatBatch{Reset: true, History: app.HistoryEnd}) == nil {
			f.reset, f.history = false, historySent
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
		f.history = historyComing
		f.t = f.fresh()
	}
	if info.Size() == f.offset {
		if !f.reset {
			f.queue(f.t.quiet(time.Since(f.grew), f.entryMax))
		}
		f.readTo(true)
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
	atEnd := f.offset >= info.Size()
	data := append(append([]byte(nil), f.partial...), chunk...)
	end := bytes.LastIndexByte(data, '\n')
	if end < 0 {
		// A line still being written is left for the next check.
		f.partial = data
		f.readTo(atEnd)
		if f.reset || f.history == historyRead {
			f.flush()
		}
		return
	}
	f.partial = append([]byte(nil), data[end+1:]...)
	for _, line := range bytes.Split(data[:end], []byte{'\n'}) {
		f.queue(f.t.line(line, f.entryMax))
	}
	f.readTo(atEnd)
	f.flush()
}

// readTo notes a read of the history that reached the transcript's end,
// once the transcriber holds nothing back for a later quiet: what it holds
// is history still to send.
func (f *follower) readTo(atEnd bool) {
	if atEnd && f.history != historySent && !f.t.holds() {
		f.history = historyRead
	}
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
// them left. While the history is coming each batch says so, and the last
// one of a read that reached the transcript's end says that, even with no
// entries left to carry.
func (f *follower) flush() bool {
	for len(f.pending) > 0 || f.reset || f.history == historyRead {
		n, size := 0, 0
		for n < len(f.pending) && n < f.batchMax && (n == 0 || size+len(f.pending[n]) <= chatBatchBytes) {
			size += len(f.pending[n])
			n++
		}
		marker := f.history.marker(n == len(f.pending))
		if err := f.emit(app.ChatBatch{Reset: f.reset, History: marker, Entries: f.pending[:n]}); err != nil {
			return false
		}
		f.pending, f.reset = f.pending[n:], false
		if marker == app.HistoryEnd {
			f.history = historySent
		}
	}
	f.pending = nil
	return true
}
