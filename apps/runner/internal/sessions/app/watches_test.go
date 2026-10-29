package app_test

import (
	"context"
	"fmt"
	"slices"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

const (
	watchOne = "6f1c1f9e-0b5d-4c38-9a4e-1f0d6c1b2a01"
	watchTwo = "6f1c1f9e-0b5d-4c38-9a4e-1f0d6c1b2a02"
)

type watchHarness struct {
	*fakeHarness
	clock   *stepClock
	session domain.Session
}

func newWatchHarness(t *testing.T) *watchHarness {
	t.Helper()
	clock := &stepClock{now: time.Date(2026, 10, 29, 9, 0, 0, 0, time.UTC)}
	h := newClockedHarness(t, clock)
	return &watchHarness{fakeHarness: h, clock: clock, session: h.open(t)}
}

func (h *watchHarness) show(screen string) { h.terminals.Screens[h.session.Target(0)] = screen }

// pass is one poll: the loop's RefreshAll, or a single-session Refresh.
func (h *watchHarness) pass(t *testing.T, single bool) {
	t.Helper()
	var err error
	if single {
		_, err = h.svc.Refresh(context.Background(), h.session.ID)
	} else {
		_, err = h.svc.RefreshAll(context.Background())
	}
	if err != nil {
		t.Fatal(err)
	}
}

func (h *watchHarness) watch(t *testing.T, watchID, pattern string) {
	t.Helper()
	if err := h.svc.Watch(h.session.ID, watchID, pattern); err != nil {
		t.Fatal(err)
	}
}

func codeOf(err error) string {
	if pe := problem.From(err); pe != nil {
		return pe.Code
	}
	return ""
}

// Both passes that capture a live session's screen scan it: the first
// match goes out at once with a count, a line that stays on screen is not
// counted again, and what matches inside five seconds waits for the next
// report.
func TestARefreshReportsATerminalWatchesMatches(t *testing.T) {
	for _, single := range []bool{false, true} {
		t.Run(fmt.Sprintf("single=%v", single), func(t *testing.T) {
			h := newWatchHarness(t)
			h.watch(t, watchOne, `(?i)error`)

			h.show("compiling\nERROR: boom\n")
			h.pass(t, single)
			h.clock.Advance(2 * time.Second)
			h.show("ERROR: boom\nerror: again\n")
			h.pass(t, single)
			h.clock.Advance(3 * time.Second)
			h.pass(t, single)

			want := []terminalMatch{
				{session: h.session.ID, watch: watchOne, count: 1},
				{session: h.session.ID, watch: watchOne, count: 2},
			}
			if !slices.Equal(h.events.matches, want) {
				t.Fatalf("reports = %+v, want %+v", h.events.matches, want)
			}
		})
	}
}

// A watch sent again under its id replaces the first, count and all; an
// unwatched one reports nothing more, and unwatching one the runner does not
// hold is no error.
func TestAWatchIsReplacedByItsIDAndStoppedByUnwatch(t *testing.T) {
	h := newWatchHarness(t)
	h.watch(t, watchOne, `never`)
	h.watch(t, watchOne, `^done`)
	h.watch(t, watchTwo, `^done`)
	h.show("done 1\n")
	h.pass(t, false)

	h.svc.Unwatch(h.session.ID, watchTwo)
	h.svc.Unwatch(h.session.ID, "not-a-watch")
	h.svc.Unwatch("not-a-session", watchOne)
	h.clock.Advance(time.Minute)
	h.show("done 1\ndone 2\n")
	h.pass(t, false)

	var one, two []int
	for _, m := range h.events.matches {
		switch m.watch {
		case watchOne:
			one = append(one, m.count)
		case watchTwo:
			two = append(two, m.count)
		}
	}
	if !slices.Equal(one, []int{1, 2}) || !slices.Equal(two, []int{1}) {
		t.Fatalf("watch one reported %v, two %v; want [1 2] and [1]", one, two)
	}
}

// A watch is dropped after its hundredth report.
func TestAWatchIsDroppedAfterItsLastReport(t *testing.T) {
	h := newWatchHarness(t)
	h.watch(t, watchOne, `^tick`)
	for i := range domain.WatchReportsMax + 5 {
		h.show(fmt.Sprintf("tick %d\n", i))
		h.pass(t, false)
		h.clock.Advance(domain.WatchReportEvery)
	}
	if got := len(h.events.matches); got != domain.WatchReportsMax {
		t.Fatalf("%d reports, want %d", got, domain.WatchReportsMax)
	}
}

// A session that stops takes its watches with it: restarted, it reports
// nothing until the control plane watches it again.
func TestAStoppedSessionDropsItsWatches(t *testing.T) {
	h := newWatchHarness(t)
	h.watch(t, watchOne, `^error`)
	if _, err := h.svc.Stop(context.Background(), h.session.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := h.svc.Restart(context.Background(), h.session.ID); err != nil {
		t.Fatal(err)
	}
	h.show("error: after the restart\n")
	h.pass(t, false)
	if len(h.events.matches) != 0 {
		t.Fatalf("a stopped session's watch reported: %+v", h.events.matches)
	}
}

// A watch whose session's tmux session vanished goes with it.
func TestASessionThatDisappearsDropsItsWatches(t *testing.T) {
	h := newWatchHarness(t)
	h.watch(t, watchOne, `^error`)
	if err := h.terminals.Kill(context.Background(), h.session.TmuxName()); err != nil {
		t.Fatal(err)
	}
	h.pass(t, false)
	if _, err := h.svc.Restart(context.Background(), h.session.ID); err != nil {
		t.Fatal(err)
	}
	h.show("error: after the restart\n")
	h.pass(t, false)
	if len(h.events.matches) != 0 {
		t.Fatalf("a vanished session's watch reported: %+v", h.events.matches)
	}
}

// What a watch is refused for: a pattern that is not one, a session this host
// does not know, one that is no longer running.
func TestAWatchIsRefused(t *testing.T) {
	h := newWatchHarness(t)
	if err := h.svc.Watch(h.session.ID, watchOne, `(unclosed`); codeOf(err) != "INVALID_PATTERN" {
		t.Fatalf("invalid pattern: err = %v, want INVALID_PATTERN", err)
	}
	if err := h.svc.Watch("no-such-session", watchOne, `ok`); codeOf(err) != domain.ErrNotFound.Code {
		t.Fatalf("unknown session: err = %v, want %s", err, domain.ErrNotFound.Code)
	}
	if _, err := h.svc.Stop(context.Background(), h.session.ID); err != nil {
		t.Fatal(err)
	}
	if err := h.svc.Watch(h.session.ID, watchOne, `ok`); codeOf(err) != domain.ErrNotRunning.Code {
		t.Fatalf("stopped session: err = %v, want %s", err, domain.ErrNotRunning.Code)
	}
}

var _ app.Publisher = (*recorder)(nil)
