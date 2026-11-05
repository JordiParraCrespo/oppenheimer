package transcript

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// A conversation read one page at a time on request (`transcript.read`,
// `product/next-steps/agent-tools.md` §8), for a reader with no browser
// attached: a bot, the `opp` CLI, an MCP client. The entries are the ones
// Follow sends the chat view; a page is addressed by the conversation's name
// and a byte offset where one of its lines starts, which the control plane
// hands back as an opaque cursor.

// ReadPage implements app.Transcripts. Without a conversation the page is
// the tail: the last turns of a transcript that can be cut at a turn's
// opening (Claude Code's), as many as reach its end within the page's
// bounds, and the whole conversation from its start otherwise. With the
// conversation a page was read from, the lines after req.After. A cursor
// for another conversation, past the file's end or not where a line starts
// (the CLI replaced the file) is read from the start, Restarted. Only whole
// lines are read: one the CLI is still writing waits for the next page.
func (r *Reader) ReadPage(session domain.Session, req app.TranscriptPageRequest) (app.TranscriptPage, error) {
	if session.Agent.ServesConversation() {
		return app.TranscriptPage{}, app.ErrNoChat
	}
	source, ok := r.chats[session.Agent]
	if !ok {
		return app.TranscriptPage{}, app.ErrNoChat
	}
	find, ok := source.finder(session)
	if !ok {
		return app.TranscriptPage{}, app.ErrNoChat
	}
	empty := app.TranscriptPage{Entries: []string{}, AtEnd: true}
	path := find()
	if path == "" {
		return empty, nil
	}
	info, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return empty, nil
	}
	if err != nil {
		return app.TranscriptPage{}, err
	}
	size, conversation := info.Size(), conversationName(path)
	read := func(start int64) (app.TranscriptPage, error) {
		page, err := readPage(path, start, size, info.ModTime(), source.transcriber(), req)
		page.Conversation = conversation
		return page, err
	}

	if req.Conversation == "" {
		cut, ok := source.(turnCutter)
		if !ok {
			return read(0)
		}
		// The fewest turns back that still reach the end, from tailTurns
		// down: a page that stops short of the end is not its tail.
		for turns := tailTurns; ; turns /= 2 {
			start, err := pageStart(path, size, turns, cut.opensTurn)
			if err != nil {
				return app.TranscriptPage{}, err
			}
			page, err := read(start)
			if err != nil || page.AtEnd || turns <= 1 {
				return page, err
			}
		}
	}
	if req.Conversation != conversation || req.After < 0 || req.After > size ||
		(req.After > 0 && !lineStartsAt(path, req.After)) {
		page, err := read(0)
		page.Restarted = true
		return page, err
	}
	return read(req.After)
}

// conversationName is what a conversation is called on the link: a digest
// of where its file is, so a new file (the agent cleared the conversation,
// or the person started another) is a new name and the path never leaves
// the host.
func conversationName(path string) string {
	sum := sha256.Sum256([]byte(path))
	return hex.EncodeToString(sum[:8])
}

// pageTally is a page as it is read: what it holds, and where it ends.
type pageTally struct {
	entries []string
	bytes   int
	dropped int
	next    int64
}

// fits is whether out would join the page whole within its bounds.
func (p pageTally) fits(out [][]byte, req app.TranscriptPageRequest) bool {
	n, size := len(p.entries), p.bytes
	for _, entry := range out {
		if len(entry) > 0 && len(entry) <= req.EntryMax {
			n++
			size += len(entry)
		}
	}
	return n <= req.Limit && size <= req.BytesMax
}

// take adds out to the page, as much of it as fits; the rest is dropped.
func (p *pageTally) take(out [][]byte, req app.TranscriptPageRequest) {
	for _, entry := range out {
		switch {
		case len(entry) == 0:
		case len(entry) > req.EntryMax, len(p.entries) >= req.Limit, p.bytes+len(entry) > req.BytesMax:
			p.dropped++
		default:
			p.entries = append(p.entries, string(entry))
			p.bytes += len(entry)
		}
	}
}

// readPage reads the file's whole lines forward from start, up to size (its
// length when the read began), with a fresh transcriber t: at most one
// Follow read's worth (followReadMax), and stopping before the line whose
// entries would take the page past its bounds, though never before a first
// line, so a cursor always moves.
//
// A transcriber that holds lines back (Grok's, whose reply arrives in
// chunks) is asked for them at the end only once the file has been quiet as
// long as the chat view waits, by its last write: a reply still being
// written is not cut in two. Whatever it still holds is not on the page,
// which then ends after the last line that left it holding nothing, so the
// next page reads those lines again whole; AtEnd still says the read
// reached the end of what is written.
func readPage(path string, start, size int64, modified time.Time, t chatTranscriber, req app.TranscriptPageRequest) (app.TranscriptPage, error) {
	page := app.TranscriptPage{Entries: []string{}, From: start, Next: start}
	_, byLine := t.(lineByLine)
	page.Partial = !byLine && start > 0
	file, err := os.Open(path) //nolint:gosec // the conversation's own file, found by the source's finder
	if err != nil {
		return page, err
	}
	defer func() { _ = file.Close() }()
	if _, err := file.Seek(start, io.SeekStart); err != nil {
		return page, err
	}
	lines := bufio.NewReaderSize(io.LimitReader(file, size-start), 64<<10)

	p := pageTally{entries: []string{}, next: start}
	settled := p
	full, atEnd, consumed := false, false, 0
	for p.next-start < followReadMax {
		line, whole, err := nextLine(lines, pageWindowMax)
		if err != nil {
			return page, err
		}
		if !whole {
			atEnd = true
			break
		}
		var out [][]byte
		if !line.long {
			out = t.line(line.text, req.EntryMax)
		}
		if consumed > 0 && !p.fits(out, req) {
			full = true
			break
		}
		p.take(out, req)
		if line.long {
			p.dropped++
		}
		p.next += line.size
		consumed++
		if !t.holds() {
			settled = p
		}
	}
	if atEnd && t.holds() {
		out := t.quiet(time.Since(modified), req.EntryMax)
		if len(out) > 0 && !p.fits(out, req) && len(p.entries) > 0 {
			full, atEnd = true, false
		} else {
			p.take(out, req)
			if !t.holds() {
				settled = p
			}
		}
	}
	switch {
	case !t.holds():
	case settled.next > start || atEnd:
		p = settled
		p.entries = p.entries[:len(settled.entries):len(settled.entries)]
	default:
		// Held since the page's start and cut by its bounds: the page moves
		// on, and what was held is not placed.
		page.Partial = true
	}
	page.Entries, page.Dropped, page.Next = p.entries, p.dropped, p.next
	page.AtEnd = atEnd && !full
	return page, nil
}

// pageLine is one whole line of a conversation file, without its newline.
type pageLine struct {
	text []byte
	// size is the bytes it takes in the file, its newline included.
	size int64
	// long is a line over the most one read holds, read past and not kept.
	long bool
}

// nextLine reads the next whole line, keeping at most max bytes of it;
// false when the file ends before its newline, a line still being written.
func nextLine(r *bufio.Reader, max int) (pageLine, bool, error) {
	var line pageLine
	for {
		chunk, err := r.ReadSlice('\n')
		line.size += int64(len(chunk))
		if !line.long {
			if len(line.text)+len(chunk) > max {
				line.long, line.text = true, nil
			} else {
				line.text = append(line.text, chunk...)
			}
		}
		switch {
		case err == nil:
			if !line.long {
				line.text = line.text[:len(line.text)-1]
			}
			return line, true, nil
		case errors.Is(err, bufio.ErrBufferFull):
		case errors.Is(err, io.EOF):
			return pageLine{}, false, nil
		default:
			return pageLine{}, false, err
		}
	}
}
