package app_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const blockedScreen = "Do you want to proceed?\n 1. Yes\n 2. No"

type stepClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *stepClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *stepClock) Advance(d time.Duration) {
	c.mu.Lock()
	c.now = c.now.Add(d)
	c.mu.Unlock()
}

func newClockedHarness(t *testing.T, clock *stepClock) *fakeHarness {
	t.Helper()
	terminals, worktrees := fake.NewTerminals(), fake.NewWorktrees()
	events, store, files, places := &recorder{}, &memoryStore{}, fake.NewFiles(), fake.NewPlaces()
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: worktrees, Classifier: manifest.New(manifest.Options{}),
		Store: store, Publisher: events, Files: files,
		Places: places, Layout: domain.Layout{Root: "/home/jordi/oppenheimer"},
		Now: clock.Now,
	})
	if err != nil {
		t.Fatal(err)
	}
	return &fakeHarness{svc: svc, terminals: terminals, worktrees: worktrees, events: events, store: store, files: files, places: places}
}

func countBlocked(states []domain.State) int {
	n := 0
	for _, state := range states {
		if state == domain.StateBlocked {
			n++
		}
	}
	return n
}

// The control plane counts how long an agent has been blocked only from a
// second report of it, so an agent that stays blocked is announced once more:
// without it a session asking a question never comes to wait on anyone.
func TestAnAgentStillBlockedIsAnnouncedOnceMore(t *testing.T) {
	clock := &stepClock{now: time.Date(2026, 10, 26, 9, 0, 0, 0, time.UTC)}
	h := newClockedHarness(t, clock)
	session := h.open(t)
	h.terminals.Screens[session.Target(0)] = blockedScreen
	refresh := func() {
		t.Helper()
		if _, err := h.svc.Refresh(context.Background(), session.ID); err != nil {
			t.Fatal(err)
		}
	}

	refresh()
	if got := countBlocked(h.events.states); got != 1 {
		t.Fatalf("blocked announced %d times on the change, want 1", got)
	}

	clock.Advance(time.Second)
	refresh()
	if got := countBlocked(h.events.states); got != 1 {
		t.Fatalf("blocked announced %d times after 1 s, want 1: too early to confirm", got)
	}

	clock.Advance(app.BlockedConfirmAfter)
	refresh()
	if got := countBlocked(h.events.states); got != 2 {
		t.Fatalf("blocked announced %d times after %s, want 2", got, app.BlockedConfirmAfter+time.Second)
	}

	clock.Advance(time.Minute)
	refresh()
	refresh()
	if got := countBlocked(h.events.states); got != 2 {
		t.Fatalf("blocked announced %d times later on, want 2: one confirmation per wait", got)
	}

	// A new wait after the agent moved on is confirmed again.
	h.terminals.Screens[session.Target(0)] = workingScreen
	refresh()
	h.terminals.Screens[session.Target(0)] = blockedScreen
	refresh()
	clock.Advance(20 * time.Second)
	refresh()
	if got := countBlocked(h.events.states); got != 4 {
		t.Fatalf("blocked announced %d times over two waits, want 4", got)
	}
}

// The second report is when the person is told, so nothing but the agent
// moving on may delay it: a window opened while the agent waits writes the
// session, and must not restart the confirmation's clock. The service also
// says when that confirmation is due, which is when its loop looks again.
func TestAWindowOpenedWhileBlockedDoesNotDelayTheConfirmation(t *testing.T) {
	clock := &stepClock{now: time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)}
	h := newClockedHarness(t, clock)
	session := h.open(t)
	h.terminals.Screens[session.Target(0)] = blockedScreen
	refresh := func() {
		t.Helper()
		if _, err := h.svc.Refresh(context.Background(), session.ID); err != nil {
			t.Fatal(err)
		}
	}

	if _, pending := h.svc.NextConfirmation(); pending {
		t.Fatal("a confirmation is due before any agent blocked")
	}
	refresh()
	if due, pending := h.svc.NextConfirmation(); !pending || due != app.BlockedConfirmAfter {
		t.Fatalf("next confirmation = %s, %v; want %s, true", due, pending, app.BlockedConfirmAfter)
	}

	clock.Advance(2 * time.Second)
	if _, err := h.svc.OpenWindow(context.Background(), session.ID, app.WindowInput{}); err != nil {
		t.Fatal(err)
	}
	clock.Advance(app.BlockedConfirmAfter - 2*time.Second)
	refresh()
	if got := countBlocked(h.events.states); got != 2 {
		t.Fatalf("blocked announced %d times %s after the block, want 2: the window delayed it", got, app.BlockedConfirmAfter)
	}
	if _, pending := h.svc.NextConfirmation(); pending {
		t.Fatal("a confirmation is still due after it was sent")
	}
}
