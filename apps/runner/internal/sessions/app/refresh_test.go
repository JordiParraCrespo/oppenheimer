package app_test

import (
	"context"
	"slices"
	"sync"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const workingScreen = "⠹ Thinking… (12s · esc to interrupt)"

// countingTerminals counts the tmux calls a refresh makes and, once paused,
// holds Capture until the test releases it: the window in which a command
// can land between a refresh's read and its write.
type countingTerminals struct {
	*fake.Terminals

	mu                               sync.Mutex
	has, capture, captureBody, panes int
	entered, release                 chan struct{}
}

func (c *countingTerminals) Has(ctx context.Context, name string) (bool, error) {
	c.mu.Lock()
	c.has++
	c.mu.Unlock()
	return c.Terminals.Has(ctx, name)
}

func (c *countingTerminals) Capture(ctx context.Context, target string) (app.Screen, error) {
	c.mu.Lock()
	c.capture++
	entered, release := c.entered, c.release
	c.mu.Unlock()
	// The screen is read before pausing, as a capture-pane that returned
	// just before the session was killed would have.
	screen, err := c.Terminals.Capture(ctx, target)
	if entered != nil {
		entered <- struct{}{}
		<-release
	}
	return screen, err
}

func (c *countingTerminals) CaptureBody(ctx context.Context, target string) (string, error) {
	c.mu.Lock()
	c.captureBody++
	c.mu.Unlock()
	return c.Terminals.CaptureBody(ctx, target)
}

func (c *countingTerminals) Panes(ctx context.Context) ([]app.Pane, error) {
	c.mu.Lock()
	c.panes++
	c.mu.Unlock()
	return c.Terminals.Panes(ctx)
}

// pause makes the next Capture block until the returned resume is called,
// and returns once a refresh is inside it.
func (c *countingTerminals) pause() (inside <-chan struct{}, resume func()) {
	entered, release := make(chan struct{}), make(chan struct{})
	c.mu.Lock()
	c.entered, c.release = entered, release
	c.mu.Unlock()
	return entered, func() {
		c.mu.Lock()
		c.entered, c.release = nil, nil
		c.mu.Unlock()
		close(release)
	}
}

type syncRecorder struct {
	mu     sync.Mutex
	states []domain.State
}

func (r *syncRecorder) SessionChanged(s domain.Session) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.states = append(r.states, s.State)
}

func (r *syncRecorder) seen() []domain.State {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.states)
}

type syncStore struct {
	mu    sync.Mutex
	saves int
}

func (m *syncStore) Load() ([]domain.Session, error) { return nil, nil }

func (m *syncStore) Save([]domain.Session) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.saves++
	return nil
}

func (m *syncStore) count() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.saves
}

type refreshHarness struct {
	svc       *app.Service
	terminals *countingTerminals
	events    *syncRecorder
	store     *syncStore
}

func newRefreshHarness(t *testing.T) *refreshHarness {
	t.Helper()
	terminals := &countingTerminals{Terminals: fake.NewTerminals()}
	events, store := &syncRecorder{}, &syncStore{}
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Store: store, Publisher: events,
		Layout: domain.Layout{Root: "/home/jordi/oppenheimer-ai/workspaces"},
	})
	if err != nil {
		t.Fatal(err)
	}
	return &refreshHarness{svc: svc, terminals: terminals, events: events, store: store}
}

func (h *refreshHarness) open(t *testing.T) domain.Session {
	t.Helper()
	session, err := h.svc.Create(context.Background(), app.CreateInput{
		Repo: "jordi/oppenheimer", BaseBranch: "main", Agent: domain.AgentClaude,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	h.terminals.SendKeys(context.Background(), session.Target(0), workingScreen) //nolint:errcheck // the fake cannot fail
	return session
}

// refreshDuring runs a Refresh of id, pauses it between its read and its
// write, runs command, then lets the refresh finish.
func (h *refreshHarness) refreshDuring(t *testing.T, id string, command func()) {
	t.Helper()
	inside, resume := h.terminals.pause()
	done := make(chan struct{})
	go func() {
		defer close(done)
		_, _ = h.svc.Refresh(context.Background(), id)
	}()
	<-inside
	command()
	resume()
	<-done
}

func (h *refreshHarness) state(t *testing.T, id string) domain.State {
	t.Helper()
	session, err := h.svc.Get(id)
	if err != nil {
		t.Fatal(err)
	}
	return session.State
}

func TestRefreshDoesNotOverwriteAConcurrentClose(t *testing.T) {
	h := newRefreshHarness(t)
	session := h.open(t)

	h.refreshDuring(t, session.ID, func() {
		if _, err := h.svc.Close(context.Background(), session.ID, app.CloseInput{Force: true}); err != nil {
			t.Errorf("close: %v", err)
		}
	})
	if got := h.state(t, session.ID); got != domain.StateClosed {
		t.Fatalf("after a refresh that raced the close, state = %q, want closed", got)
	}

	// The next ticks find no tmux session; a closed session stays closed.
	if _, err := h.svc.RefreshAll(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := h.svc.Refresh(context.Background(), session.ID); err != nil {
		t.Fatal(err)
	}
	if got := h.state(t, session.ID); got != domain.StateClosed {
		t.Fatalf("state = %q, want closed", got)
	}
	if got := h.events.seen(); !slices.Equal(got, []domain.State{domain.StateClosed}) {
		t.Fatalf("published %v, want only the close", got)
	}
}

func TestRefreshDoesNotOverwriteAConcurrentStop(t *testing.T) {
	h := newRefreshHarness(t)
	session := h.open(t)

	h.refreshDuring(t, session.ID, func() {
		if _, err := h.svc.Stop(context.Background(), session.ID); err != nil {
			t.Errorf("stop: %v", err)
		}
	})
	if _, err := h.svc.RefreshAll(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := h.svc.Refresh(context.Background(), session.ID); err != nil {
		t.Fatal(err)
	}

	if got := h.state(t, session.ID); got != domain.StateStopped {
		t.Fatalf("state = %q, want stopped", got)
	}
	if got := h.events.seen(); !slices.Equal(got, []domain.State{domain.StateStopped}) {
		t.Fatalf("published %v, want exactly one stop", got)
	}
}

func TestRefreshKeepsAWindowOpenedMeanwhile(t *testing.T) {
	h := newRefreshHarness(t)
	session := h.open(t)

	h.refreshDuring(t, session.ID, func() {
		if _, err := h.svc.OpenWindow(context.Background(), session.ID); err != nil {
			t.Errorf("open window: %v", err)
		}
	})
	// The next refresh applies its state to the record, not to a copy.
	refreshed, err := h.svc.Refresh(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	got, _ := h.svc.Get(session.ID)
	if len(got.Windows) != 2 || len(refreshed.Windows) != 2 {
		t.Fatalf("windows = %+v, want the agent and the new tab", got.Windows)
	}
	if got.State != domain.StateWorking {
		t.Fatalf("state = %q, want working", got.State)
	}
}

func TestRefreshWithNoChangeDoesNotSave(t *testing.T) {
	h := newRefreshHarness(t)
	session := h.open(t)
	if _, err := h.svc.Refresh(context.Background(), session.ID); err != nil {
		t.Fatal(err)
	}
	before, _ := h.svc.Get(session.ID)
	saves, events := h.store.count(), len(h.events.seen())

	for range 3 {
		if _, err := h.svc.Refresh(context.Background(), session.ID); err != nil {
			t.Fatal(err)
		}
		if _, err := h.svc.RefreshAll(context.Background()); err != nil {
			t.Fatal(err)
		}
	}

	after, _ := h.svc.Get(session.ID)
	if h.store.count() != saves {
		t.Fatalf("saves = %d, want %d: nothing changed, so nothing is written", h.store.count(), saves)
	}
	if !after.Updated.Equal(before.Updated) {
		t.Fatalf("updated moved from %v to %v on a no-op", before.Updated, after.Updated)
	}
	if len(h.events.seen()) != events {
		t.Fatalf("published %v on a no-op", h.events.seen()[events:])
	}
}

func TestRefreshAllListsPanesOnce(t *testing.T) {
	h := newRefreshHarness(t)
	a, b, gone := h.open(t), h.open(t), h.open(t)
	// Killed behind the service's back, as a host reboot would.
	if err := h.terminals.Kill(context.Background(), gone.TmuxName()); err != nil {
		t.Fatal(err)
	}

	if _, err := h.svc.RefreshAll(context.Background()); err != nil {
		t.Fatal(err)
	}

	c := h.terminals
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.panes != 1 || c.captureBody != 2 || c.has != 0 || c.capture != 0 {
		t.Fatalf("panes=%d captureBody=%d has=%d capture=%d, want 1, 2, 0, 0",
			c.panes, c.captureBody, c.has, c.capture)
	}
	for id, want := range map[string]domain.State{
		a.ID: domain.StateWorking, b.ID: domain.StateWorking, gone.ID: domain.StateStopped,
	} {
		if got := h.state(t, id); got != want {
			t.Fatalf("%s = %q, want %q", id, got, want)
		}
	}
}

// Many refreshes racing the commands that write a session: the race detector
// is the assertion, plus a closed session that stays closed.
func TestRefreshesRacingCommandsStayConsistent(t *testing.T) {
	h := newRefreshHarness(t)
	session := h.open(t)
	ctx := context.Background()

	var wg sync.WaitGroup
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range 50 {
				_, _ = h.svc.RefreshAll(ctx)
				_, _ = h.svc.Refresh(ctx, session.ID)
			}
		}()
	}
	for range 20 {
		if w, err := h.svc.OpenWindow(ctx, session.ID); err == nil {
			_ = h.svc.CloseWindow(ctx, session.ID, w.Index)
		}
	}
	if _, err := h.svc.Close(ctx, session.ID, app.CloseInput{Force: true}); err != nil {
		t.Fatal(err)
	}
	wg.Wait()

	if got := h.state(t, session.ID); got != domain.StateClosed {
		t.Fatalf("state = %q, want closed", got)
	}
	events := h.events.seen()
	if events[len(events)-1] != domain.StateClosed || slices.Contains(events, domain.StateStopped) {
		t.Fatalf("published %v, want closed last and no stop", events)
	}
}
