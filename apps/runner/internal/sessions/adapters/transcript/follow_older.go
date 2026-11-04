package transcript

import (
	"bytes"
	"errors"
	"io"
	"os"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
)

// A conversation sent tail first (`product/next-steps/0.7-terminal-and-chat.md`,
// "Tail first"): an attach sends the last turns, and the console asks for
// the turns before an offset as the reader scrolls up. A long conversation
// was otherwise megabytes read, previewed, sent and parsed to draw its end.
const (
	// tailTurns is how many turns an attach sends as the history: what the
	// chat draws before the reader scrolls.
	tailTurns = 40
	// olderTurns is how many turns each older page holds.
	olderTurns = 40
	// pageWindowMax bounds how far back a page's start is looked for when a
	// line longer than a read (a screenshot's) leaves none in it.
	pageWindowMax = 64 << 20
)

// turnCutter is a chatSource whose transcript can be cut at a turn's
// opening: every line reads on its own, and a person's message tells where
// a turn starts. Claude Code's is; a source with a transcriber that carries
// state from line to line is not, and sends its whole history.
type turnCutter interface {
	opensTurn(line []byte) bool
}

// pageStart is where the page of a transcript that ends at end begins: the
// line that opens its turns-th turn from the end, read back from there at
// most one read's worth (`followReadMax`). With fewer turns in that read,
// the earliest one that opens there; with none, the first whole line in it;
// at the start of the file, 0. A cut is only ever before a turn's opening,
// so a tool call is never sent without its result.
func pageStart(path string, end int64, turns int, opens func([]byte) bool) (int64, error) {
	file, err := os.Open(path) //nolint:gosec // the followed conversation's own file, found by the source's finder
	if err != nil {
		return 0, err
	}
	defer func() { _ = file.Close() }()
	for window := int64(followReadMax); ; window *= 2 {
		from := max(0, end-window)
		data := make([]byte, end-from)
		if _, err := file.ReadAt(data, from); err != nil && !errors.Is(err, io.EOF) {
			return 0, err
		}
		var starts []int64
		if from == 0 {
			starts = append(starts, 0)
		}
		for i, b := range data {
			if b == '\n' && from+int64(i)+1 < end {
				starts = append(starts, from+int64(i)+1)
			}
		}
		if len(starts) == 0 {
			if window >= pageWindowMax {
				return 0, nil
			}
			continue
		}
		earliest, found := int64(0), 0
		for k := len(starts) - 1; k >= 0; k-- {
			lineEnd := end
			if k+1 < len(starts) {
				lineEnd = starts[k+1] - 1
			}
			if opens(bytes.TrimRight(data[starts[k]-from:lineEnd-from], "\r\n")) {
				earliest = starts[k]
				found++
				if found == turns {
					return earliest, nil
				}
			}
		}
		switch {
		case from == 0:
			return 0, nil
		case found > 0:
			return earliest, nil
		default:
			return starts[0], nil
		}
	}
}

// olderPage is a page of older turns asked for and not yet all sent.
type olderPage struct {
	pending []string
	// before is where the page starts, which its last batch says.
	before int64
	asked  bool
}

// askOlder reads the turns before before, the offset the console holds the
// conversation from, into the page to send. An offset this follower cannot
// answer (it sends the whole history, it has not read that far, or it is
// not where a line starts: the file was replaced) is answered with an empty
// page that says nothing is older, and a page already on its way is not
// asked again.
func (f *follower) askOlder(before int64) {
	if f.older.asked {
		return
	}
	f.older = olderPage{asked: true}
	if f.opens == nil || before <= 0 || before > f.offset || !lineStartsAt(f.path, before) {
		return
	}
	start, err := pageStart(f.path, before, olderTurns, f.opens)
	if err != nil {
		return
	}
	data, err := readRange(f.path, start, before)
	if err != nil {
		return
	}
	t := f.fresh()
	for _, line := range bytes.Split(bytes.TrimSuffix(data, []byte{'\n'}), []byte{'\n'}) {
		for _, entry := range t.line(line, f.entryMax) {
			if len(entry) <= f.entryMax {
				f.older.pending = append(f.older.pending, string(entry))
			}
		}
	}
	f.older.before = start
}

// flushOlder sends what is left of the page asked for, in batches marked
// older, the last with where the page starts. A batch the link refuses is
// offered again on the next check.
func (f *follower) flushOlder() {
	for f.older.asked {
		n, size := 0, 0
		for n < len(f.older.pending) && n < f.batchMax && (n == 0 || size+len(f.older.pending[n]) <= chatBatchBytes) {
			size += len(f.older.pending[n])
			n++
		}
		batch := app.ChatBatch{Older: app.HistoryMore, Entries: f.older.pending[:n]}
		last := n == len(f.older.pending)
		if last {
			batch.Older, batch.Before = app.HistoryEnd, f.older.before
		}
		if f.emit(batch) != nil {
			return
		}
		f.older.pending = f.older.pending[n:]
		if last {
			f.older = olderPage{}
		}
	}
}

// lineStartsAt is whether offset is where a line of the file starts.
func lineStartsAt(path string, offset int64) bool {
	data, err := readRange(path, offset-1, offset)
	return err == nil && len(data) == 1 && data[0] == '\n'
}

// readRange is the file's bytes from from to end.
func readRange(path string, from, end int64) ([]byte, error) {
	file, err := os.Open(path) //nolint:gosec // the followed conversation's own file, found by the source's finder
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()
	data := make([]byte, end-from)
	n, err := file.ReadAt(data, from)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}
	return data[:n], nil
}
