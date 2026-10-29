package domain

import (
	"regexp"
	"strings"
	"time"
)

// A terminal watch is a bot's pattern over a live session's screen
// (`session.watch`): the runner scans the screen it already reads on every
// pass and reports how many lines matched, never which. Watches live in
// memory only; the control plane sends them again on every hello.
const (
	// WatchPatternMax is the longest pattern a watch takes, in bytes
	// (TERMINAL_WATCH_PATTERN_MAX).
	WatchPatternMax = 200
	// WatchReportEvery is the quiet period between two reports of one watch;
	// lines that match meanwhile are counted into the next.
	WatchReportEvery = 5 * time.Second
	// WatchReportsMax is how many reports a watch makes before it is dropped.
	WatchReportsMax = 100
	// WatchSeenMax bounds the line texts a watch remembers having counted, so
	// a line that stays on screen is counted once without the set growing
	// for as long as the session runs.
	WatchSeenMax = 512
)

// TerminalMatchedKind is the session log entry a watch's report is.
const TerminalMatchedKind = "terminal.matched"

// Watch is one pattern over one session's screen and what it has counted.
// It is not safe for concurrent use; the caller serialises Scan.
type Watch struct {
	id      string
	pattern *regexp.Regexp
	// seen is the line texts already counted, oldest first in order.
	seen  map[string]struct{}
	order []string
	// count is every new matching line counted so far; reported is what the
	// last report said.
	count    int
	reported int
	reports  int
	last     time.Time
}

// NewWatch compiles a watch, or answers ErrInvalidPattern for a pattern that
// is empty, longer than WatchPatternMax or not an RE2 expression.
func NewWatch(id, pattern string) (*Watch, error) {
	if pattern == "" || len(pattern) > WatchPatternMax {
		return nil, ErrInvalidPattern.WithDetail("a pattern is 1 to %d bytes", WatchPatternMax)
	}
	compiled, err := regexp.Compile(pattern)
	if err != nil {
		return nil, ErrInvalidPattern.WithDetail("%v", err).WithCause(err)
	}
	return &Watch{id: id, pattern: compiled, seen: map[string]struct{}{}}, nil
}

// ID is the watch's id, which the control plane chose.
func (w *Watch) ID() string { return w.id }

// Scan counts the lines of body that match and that this watch had not
// counted before, and reports whether a report is due at now: the first one
// at once, then at most one per WatchReportEvery, each carrying the
// cumulative count. A report due on a pass with no new line still goes out,
// so matches held through a quiet period are not lost.
func (w *Watch) Scan(body string, now time.Time) (count int, report bool) {
	if w.Spent() {
		return w.count, false
	}
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimRight(line, " \t\r")
		if _, counted := w.seen[line]; counted || !w.pattern.MatchString(line) {
			continue
		}
		w.remember(line)
		w.count++
	}
	if w.count == w.reported {
		return w.count, false
	}
	if w.reports > 0 && now.Sub(w.last) < WatchReportEvery {
		return w.count, false
	}
	w.reported, w.last = w.count, now
	w.reports++
	return w.count, true
}

// Spent reports whether the watch has made all its reports and is to be
// dropped.
func (w *Watch) Spent() bool { return w.reports >= WatchReportsMax }

// remember adds a counted line, forgetting the oldest past WatchSeenMax.
func (w *Watch) remember(line string) {
	if len(w.order) >= WatchSeenMax {
		delete(w.seen, w.order[0])
		w.order = w.order[1:]
	}
	w.seen[line] = struct{}{}
	w.order = append(w.order, line)
}
