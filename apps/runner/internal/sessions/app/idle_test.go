package app_test

import (
	"context"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// An idle session stops on its own, and nothing anyone is using does.

const idleAfter = 2 * time.Hour

// idleHost is a host whose sessions all ran up to `since` and are running
// still, with a clock the test moves.
type idleHost struct {
	svc       *app.Service
	terminals *fake.Terminals
	reports   *heldReports
	clock     *time.Time
}

func newIdleHost(t *testing.T, since time.Time, sessions ...domain.Session) idleHost {
	t.Helper()
	clock := since
	terminals := fake.NewTerminals()
	places := fake.NewPlaces()
	// Each agent says what it is doing, as Claude Code does over OSC 7501:
	// the word a fresh look reads before a stop.
	reports := &heldReports{reports: map[string]domain.ProgramReport{}}
	for i, s := range sessions {
		sessions[i].Updated = since
		places.Folders[s.Folder] = true
		if s.State.Live() {
			reports.say(s.ID, "state="+string(s.State))
			if err := terminals.Create(context.Background(), s.TmuxName(), s.Folder, "claude", nil); err != nil {
				t.Fatal(err)
			}
		}
	}
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Places: places, Layout: domain.Layout{Root: "/home/jordi/oppenheimer"},
		Store: &savedMap{sessions: sessions}, Clients: terminals, ProgramStatus: reports,
		Now: func() time.Time { return clock },
	})
	if err != nil {
		t.Fatal(err)
	}
	return idleHost{svc: svc, terminals: terminals, reports: reports, clock: &clock}
}

func idleSession(id string, state domain.State) domain.Session {
	s := folderSession(id, false)
	s.State = state
	return s
}

func (h idleHost) state(t *testing.T, id string) domain.State {
	t.Helper()
	s, err := h.svc.Get(id)
	if err != nil {
		t.Fatal(err)
	}
	return s.State
}

// A done or idle agent nobody came back to is stopped past the window, and
// only past it: its processes go, the record stays, and Restart brings it back.
func TestASessionIdlePastTheWindowIsStoppedNotClosed(t *testing.T) {
	ctx := context.Background()
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	h := newIdleHost(t, start, idleSession("done", domain.StateDone), idleSession("prompt", domain.StateIdle))

	*h.clock = start.Add(idleAfter - time.Minute)
	if stopped := h.svc.StopIdle(ctx, idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped before the window: %v", stopped)
	}

	*h.clock = start.Add(idleAfter + time.Minute)
	if stopped := h.svc.StopIdle(ctx, idleAfter); len(stopped) != 2 {
		t.Fatalf("stopped %d sessions, want both", len(stopped))
	}
	for _, id := range []string{"done", "prompt"} {
		if got := h.state(t, id); got != domain.StateStopped {
			t.Fatalf("%s is %s, want stopped", id, got)
		}
		if alive, _ := h.terminals.Has(ctx, domain.Prefix+id); alive {
			t.Fatalf("%s still has its terminal", id)
		}
	}
	if _, err := h.svc.Restart(ctx, "done"); err != nil {
		t.Fatalf("an idle-stopped session does not restart: %v", err)
	}
}

// A working or blocked agent, a kept session and a session somebody is
// attached to keep running, however long they have been that way.
func TestTheIdleStopLeavesWhatIsInUse(t *testing.T) {
	ctx := context.Background()
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	kept := idleSession("kept", domain.StateDone)
	kept.Keep = true
	h := newIdleHost(t, start,
		idleSession("working", domain.StateWorking), idleSession("blocked", domain.StateBlocked),
		kept, idleSession("watched", domain.StateDone))

	pty, err := h.svc.Attach(ctx, "watched", 0, app.Size{Cols: 80, Rows: 24}, true)
	if err != nil {
		t.Fatal(err)
	}
	*h.clock = start.Add(10 * idleAfter)
	if stopped := h.svc.StopIdle(ctx, idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped sessions in use: %v", stopped)
	}

	// The window starts again when the last viewer leaves.
	_ = pty.Close()
	*h.clock = h.clock.Add(idleAfter - time.Minute)
	if stopped := h.svc.StopIdle(ctx, idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped a session just looked at: %v", stopped)
	}
	*h.clock = h.clock.Add(2 * time.Minute)
	if stopped := h.svc.StopIdle(ctx, idleAfter); len(stopped) != 1 || stopped[0].ID != "watched" {
		t.Fatalf("stopped %v, want the session once nobody watched it", stopped)
	}
}

// Typing into a session counts as using it.
func TestTypingIntoASessionRestartsItsIdleWindow(t *testing.T) {
	ctx := context.Background()
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	h := newIdleHost(t, start, idleSession("typed", domain.StateIdle))
	*h.clock = start.Add(idleAfter)
	if err := h.svc.Send(ctx, "typed", 0, "half a thought"); err != nil {
		t.Fatal(err)
	}
	*h.clock = h.clock.Add(time.Hour)
	if stopped := h.svc.StopIdle(ctx, idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped a session typed into an hour ago: %v", stopped)
	}
}

// Someone attached on the host itself (`runner sessions attach`, a bare
// `tmux attach`), whom the service never saw attach, keeps the session.
func TestTheIdleStopLeavesASessionAttachedOnTheHost(t *testing.T) {
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	h := newIdleHost(t, start, idleSession("onhost", domain.StateIdle))
	h.terminals.HostClients = map[string]int{domain.Prefix + "onhost": 1}
	*h.clock = start.Add(10 * idleAfter)
	if stopped := h.svc.StopIdle(context.Background(), idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped a session someone on the host is attached to: %v", stopped)
	}
}

// A child answers a parent still running, and stopping a parent stops its
// children: a child of a live parent, and a parent of a working child, stay.
func TestTheIdleStopLeavesAFamilyWithAWorkingMember(t *testing.T) {
	ctx := context.Background()
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	child := idleSession("child", domain.StateDone)
	child.Parent = "parent"
	h := newIdleHost(t, start, idleSession("parent", domain.StateWorking), child)
	*h.clock = start.Add(10 * idleAfter)
	if stopped := h.svc.StopIdle(ctx, idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped a child whose parent runs: %v", stopped)
	}

	lone := idleSession("lone", domain.StateDone)
	worker := idleSession("worker", domain.StateWorking)
	worker.Parent = "lone"
	h = newIdleHost(t, start, lone, worker)
	*h.clock = start.Add(10 * idleAfter)
	if stopped := h.svc.StopIdle(ctx, idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped a parent whose child runs: %v", stopped)
	}
}

// Off is off.
func TestNoWindowStopsNothing(t *testing.T) {
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	h := newIdleHost(t, start, idleSession("done", domain.StateDone))
	*h.clock = start.Add(1000 * time.Hour)
	if stopped := h.svc.StopIdle(context.Background(), 0); len(stopped) != 0 {
		t.Fatalf("stopped with the idle stop off: %v", stopped)
	}
}

// A family idle through and through is not held running by itself: the
// parent stops, and its children go with it.
func TestAnIdleFamilyStops(t *testing.T) {
	ctx := context.Background()
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	child := idleSession("child", domain.StateDone)
	child.Parent = "parent"
	h := newIdleHost(t, start, idleSession("parent", domain.StateIdle), child)
	*h.clock = start.Add(10 * idleAfter)
	stopped := h.svc.StopIdle(ctx, idleAfter)
	if len(stopped) != 1 || stopped[0].ID != "parent" {
		t.Fatalf("stopped %v, want the parent", stopped)
	}
	// With the parent stopped, the child is a session on its own.
	if again := h.svc.StopIdle(ctx, idleAfter); len(again) != 1 || again[0].ID != "child" {
		t.Fatalf("then stopped %v, want the child", again)
	}
}

// Stopping a parent stops its children's children too, so a grandchild still
// working keeps the whole line running, however idle the two above it are.
func TestTheIdleStopLeavesALineWithAWorkingGrandchild(t *testing.T) {
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	child := idleSession("child", domain.StateIdle)
	child.Parent = "parent"
	grandchild := idleSession("grandchild", domain.StateWorking)
	grandchild.Parent = "child"
	h := newIdleHost(t, start, idleSession("parent", domain.StateIdle), child, grandchild)
	*h.clock = start.Add(10 * idleAfter)
	if stopped := h.svc.StopIdle(context.Background(), idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped a line whose grandchild works: %v", stopped)
	}
}

// The state the poll loop last saw can be up to an interval old: an agent
// that took new work since is looked at again before it is stopped.
func TestTheIdleStopLooksAgainBeforeItStops(t *testing.T) {
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	h := newIdleHost(t, start, idleSession("busy", domain.StateIdle))
	// What the agent says now, after the last poll: working on a new turn.
	h.reports.say("busy", "state=working")
	*h.clock = start.Add(10 * idleAfter)
	if stopped := h.svc.StopIdle(context.Background(), idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped an agent that took new work since the last poll: %v", stopped)
	}
}

// Only window 0's agent is read for the session's state, and a stop ends
// every window: a session with a second agent in a tab is left running.
func TestTheIdleStopLeavesASessionWithASecondAgent(t *testing.T) {
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	second := idleSession("second", domain.StateIdle)
	second.Windows = append(second.Windows, domain.Window{Index: 1, Name: "codex", Agent: true})
	h := newIdleHost(t, start, second)
	*h.clock = start.Add(10 * idleAfter)
	if stopped := h.svc.StopIdle(context.Background(), idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped a session whose second agent may be working: %v", stopped)
	}
}

// The fresh look before a stop covers the whole line: a child that took new
// work since the last poll keeps its idle parent, which would take it along.
func TestTheIdleStopLooksAgainAtTheChildrenItWouldStop(t *testing.T) {
	start := time.Date(2026, 11, 24, 9, 0, 0, 0, time.UTC)
	child := idleSession("child", domain.StateDone)
	child.Parent = "parent"
	h := newIdleHost(t, start, idleSession("parent", domain.StateIdle), child)
	h.reports.say("child", "state=working")
	*h.clock = start.Add(10 * idleAfter)
	if stopped := h.svc.StopIdle(context.Background(), idleAfter); len(stopped) != 0 {
		t.Fatalf("stopped a parent whose child took new work since the last poll: %v", stopped)
	}
}
