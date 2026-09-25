package app_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// The lifecycle runs on in-memory adapters so it is fast and needs neither
// tmux nor git installed; the real adapters have their own tests next door.
type fakeHarness struct {
	svc       *app.Service
	terminals *fake.Terminals
	worktrees *fake.Worktrees
	events    *recorder
	store     *memoryStore
}

type memoryStore struct {
	sessions []domain.Session
	saves    int
}

func (m *memoryStore) Load() ([]domain.Session, error) { return m.sessions, nil }

func (m *memoryStore) Save(sessions []domain.Session) error {
	m.sessions = sessions
	m.saves++
	return nil
}

func newFakeHarness(t *testing.T) *fakeHarness {
	t.Helper()
	terminals, worktrees := fake.NewTerminals(), fake.NewWorktrees()
	events, store := &recorder{}, &memoryStore{}
	svc, err := app.New(app.Options{
		Terminals: terminals, Worktrees: worktrees, Classifier: manifest.New(manifest.Options{}),
		Store: store, Publisher: events,
		Layout: domain.Layout{Root: "/home/jordi/oppenheimer-ai/workspaces"},
		Env: func(s domain.Session) map[string]string {
			return map[string]string{"OPPENHEIMER_SESSION": s.ID}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return &fakeHarness{svc: svc, terminals: terminals, worktrees: worktrees, events: events, store: store}
}

func (h *fakeHarness) open(t *testing.T) domain.Session {
	t.Helper()
	session, err := h.svc.Create(context.Background(), app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentClaude,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return session
}

func TestCreateFetchesTheMirrorAddsAWorktreeAndStartsTheAgent(t *testing.T) {
	h := newFakeHarness(t)

	session := h.open(t)

	if h.worktrees.Mirrors["jordi/oppenheimer"] != 1 {
		t.Fatalf("mirrors = %v", h.worktrees.Mirrors)
	}
	if branch := h.worktrees.Paths[session.Worktree]; branch != session.Branch {
		t.Fatalf("worktree %q is on %q, want %q", session.Worktree, branch, session.Branch)
	}
	if dir := h.terminals.Dir(session.TmuxName()); dir != session.Worktree {
		t.Fatalf("the tmux session runs in %q, want the worktree", dir)
	}
	// Set once at creation, inherited by every window, which is how the
	// credential helper knows which session it is answering for.
	if env := h.terminals.Env(session.TmuxName()); env["OPPENHEIMER_SESSION"] != session.ID {
		t.Fatalf("env = %v", env)
	}
}

func TestCreateWithoutTmuxRefusesBeforeTouchingGit(t *testing.T) {
	h := newFakeHarness(t)
	h.terminals.Missing = true

	_, err := h.svc.Create(context.Background(), app.CreateInput{Repo: "jordi/oppenheimer"})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "TMUX_001" {
		t.Fatalf("err = %v, want TMUX_001", err)
	}
	if len(h.worktrees.Mirrors) != 0 {
		t.Fatal("nothing should have been cloned on a host that cannot run a session")
	}
}

func TestRefreshMovesTheStateWithTheScreen(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)

	for screen, want := range map[string]domain.State{
		"⠹ Thinking… (12s · esc to interrupt)":     domain.StateWorking,
		"Do you want to proceed?\n 1. Yes\n 2. No": domain.StateBlocked,
		"claude v2\n\n>\n":                         domain.StateIdle,
	} {
		h.terminals.Screens[session.Target(0)] = screen
		refreshed, err := h.svc.Refresh(context.Background(), session.ID)
		if err != nil {
			t.Fatal(err)
		}
		if refreshed.State != want {
			t.Fatalf("screen %q → %q, want %q", screen, refreshed.State, want)
		}
	}
	if len(h.events.states) == 0 {
		t.Fatal("state changes are published so the control plane can derive the sidebar")
	}
}

func TestRefreshOffersTheLoginURLOnce(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)
	h.terminals.Screens[session.Target(0)] = "Open https://claude.ai/oauth/authorize?code=true to log in"

	refreshed, err := h.svc.Refresh(context.Background(), session.ID)
	if err != nil {
		t.Fatal(err)
	}

	if refreshed.State != domain.StateBlocked || !strings.HasPrefix(refreshed.LoginURL, "https://claude.ai/") {
		t.Fatalf("session = %+v", refreshed)
	}
}

func TestListAndGetHandOutIndependentSessions(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)
	if _, err := h.svc.OpenWindow(context.Background(), session.ID); err != nil {
		t.Fatal(err)
	}

	// Copying the struct alone would share the Windows backing array, and a
	// caller editing a window would be editing the service's own state.
	listed := h.svc.List()[0]
	listed.Windows[0].Name = "mutated by a caller"
	held, err := h.svc.Get(session.ID)
	if err != nil {
		t.Fatal(err)
	}
	held.Windows = append(held.Windows, domain.Window{Index: 99})

	again, _ := h.svc.Get(session.ID)
	if again.Windows[0].Name == "mutated by a caller" || len(again.Windows) != 2 {
		t.Fatalf("stored session was changed from outside: %+v", again.Windows)
	}
}

func TestAdoptTakesBackLiveSessionsAndStopsTheRest(t *testing.T) {
	h := newFakeHarness(t)
	live := h.open(t)
	gone := h.open(t)
	if err := h.terminals.Kill(context.Background(), gone.TmuxName()); err != nil {
		t.Fatal(err)
	}

	adopted, err := h.svc.Adopt(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	if len(adopted) != 1 || adopted[0].ID != live.ID {
		t.Fatalf("adopted = %+v", adopted)
	}
	stopped, _ := h.svc.Get(gone.ID)
	if stopped.State != domain.StateStopped {
		t.Fatalf("a session whose tmux is gone is stopped, not lost: %q", stopped.State)
	}
	// Its worktree is untouched, which is what Restart needs.
	if _, ok := h.worktrees.Paths[stopped.Worktree]; !ok {
		t.Fatal("the worktree must survive a stopped session")
	}
}

func TestCloseKeepsUnsavedWorkAndForceMeansIt(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)
	h.worktrees.DirtyPaths[session.Worktree] = true

	kept, err := h.svc.Close(context.Background(), session.ID, app.CloseInput{Push: true})

	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "GIT_003" {
		t.Fatalf("err = %v, want GIT_003", err)
	}
	if !kept.Dirty || kept.State != domain.StateStopped {
		t.Fatalf("session = %+v", kept)
	}
	if _, ok := h.worktrees.Paths[session.Worktree]; !ok {
		t.Fatal("the worktree with unsaved work must still be there")
	}

	forced, err := h.svc.Close(context.Background(), session.ID, app.CloseInput{Force: true})
	if err != nil {
		t.Fatalf("forced close: %v", err)
	}
	if forced.State != domain.StateClosed {
		t.Fatalf("state = %q", forced.State)
	}
	if _, ok := h.worktrees.Paths[session.Worktree]; ok {
		t.Fatal("--force removes the worktree")
	}
}

func TestCloseIsIdempotentEnoughToRetry(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)

	if _, err := h.svc.Close(context.Background(), session.ID, app.CloseInput{Push: true}); err != nil {
		t.Fatal(err)
	}
	// A retried close — a redelivered command, or a person pressing twice —
	// must not fail.
	if _, err := h.svc.Close(context.Background(), session.ID, app.CloseInput{Push: true}); err != nil {
		t.Fatalf("second close: %v", err)
	}
}

func TestAttachAndDetachDoNotEndTheSession(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)

	attachment, err := h.svc.Attach(context.Background(), session.ID, 0, app.Size{Cols: 80, Rows: 24})
	if err != nil {
		t.Fatal(err)
	}
	if h.terminals.Attached != 1 {
		t.Fatalf("attached = %d", h.terminals.Attached)
	}
	if err := attachment.Close(); err != nil {
		t.Fatal(err)
	}

	if h.terminals.Attached != 0 {
		t.Fatalf("attached = %d after detaching", h.terminals.Attached)
	}
	if has, _ := h.terminals.Has(context.Background(), session.TmuxName()); !has {
		t.Fatal("detaching must leave the session running")
	}
}

func TestAttachRefusesAStoppedSessionAndAnUnknownWindow(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)

	if _, err := h.svc.Attach(context.Background(), session.ID, 7, app.Size{}); err == nil {
		t.Fatal("attaching to a window that does not exist must fail")
	}

	if err := h.terminals.Kill(context.Background(), session.TmuxName()); err != nil {
		t.Fatal(err)
	}
	if _, err := h.svc.Refresh(context.Background(), session.ID); err != nil {
		t.Fatal(err)
	}
	_, err := h.svc.Attach(context.Background(), session.ID, 0, app.Size{})
	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "SESS_003" {
		t.Fatalf("err = %v, want SESS_003", err)
	}
}

func TestTheSessionMapIsPersistedOnEveryChange(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)
	before := h.store.saves

	if _, err := h.svc.OpenWindow(context.Background(), session.ID); err != nil {
		t.Fatal(err)
	}

	if h.store.saves <= before {
		t.Fatal("a change to a session is written through, so a restarted runner knows about it")
	}
	if len(h.store.sessions) != 1 || h.store.sessions[0].ID != session.ID {
		t.Fatalf("stored = %+v", h.store.sessions)
	}
}

// The stages are what the console draws while a session starts, so their
// order is the contract: each starts, then lands, before the next begins.
func TestCreateReportsEachStageAsItStartsAndLands(t *testing.T) {
	h := newFakeHarness(t)
	var seen []string
	_, err := h.svc.Create(context.Background(), app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentClaude,
		Progress: func(ev domain.StageEvent) {
			state := "started"
			if ev.Done {
				state = "landed"
			}
			seen = append(seen, string(ev.Stage)+":"+state)
		},
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	want := []string{
		"clone:started", "clone:landed",
		"worktree:started", "worktree:landed",
		"agent:started", "agent:landed",
	}
	if strings.Join(seen, " ") != strings.Join(want, " ") {
		t.Fatalf("stages = %v, want %v", seen, want)
	}
}

// A failure is reported by the caller as `session.failed`; what the stages
// say is which one it was — the last to start, and it never lands.
func TestCreateThatFailsLeavesTheFailingStageUnlanded(t *testing.T) {
	h := newFakeHarness(t)
	h.worktrees.EnsureErr = domain.ErrWorktree.WithDetail("clone refused")
	var seen []domain.StageEvent
	_, err := h.svc.Create(context.Background(), app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		Progress: func(ev domain.StageEvent) { seen = append(seen, ev) },
	})
	if err == nil {
		t.Fatal("create succeeded over a failed clone")
	}
	if len(seen) != 1 || seen[0].Stage != domain.StageClone || seen[0].Done {
		t.Fatalf("stages = %+v, want only clone started", seen)
	}
}

func TestRunningNamesOnlyTheRunnersLiveTmuxSessionsAndChangesNothing(t *testing.T) {
	h := newFakeHarness(t)
	live := h.open(t)
	gone := h.open(t)
	ctx := context.Background()
	if err := h.terminals.Kill(ctx, gone.TmuxName()); err != nil {
		t.Fatal(err)
	}
	// The user's own tmux session is not ours to count, or to end.
	if err := h.terminals.Create(ctx, "work", "/home/jordi", "", nil); err != nil {
		t.Fatal(err)
	}
	saves := h.store.saves

	running, err := h.svc.Running(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(running) != 1 || running[0] != live.TmuxName() {
		t.Fatalf("running = %v, want only %s", running, live.TmuxName())
	}
	if h.store.saves != saves {
		t.Fatal("Running must not write the session map: uninstall asks it while the daemon may be writing")
	}
}

func TestEndAllKillsOurSessionsKeepsTheirCheckoutsAndLeavesTheUsersAlone(t *testing.T) {
	h := newFakeHarness(t)
	session := h.open(t)
	ctx := context.Background()
	if err := h.terminals.Create(ctx, "work", "/home/jordi", "", nil); err != nil {
		t.Fatal(err)
	}

	ended, err := h.svc.EndAll(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(ended) != 1 || ended[0] != session.TmuxName() {
		t.Fatalf("ended = %v", ended)
	}
	if has, _ := h.terminals.Has(ctx, "work"); !has {
		t.Fatal("a tmux session without the runner's prefix must survive")
	}
	stopped, _ := h.svc.Get(session.ID)
	if stopped.State != domain.StateStopped {
		t.Fatalf("state = %q, want stopped", stopped.State)
	}
	if _, ok := h.worktrees.Paths[stopped.Worktree]; !ok {
		t.Fatal("ending a session must leave its checkout on disk")
	}
	if running, _ := h.svc.Running(ctx); len(running) != 0 {
		t.Fatalf("still running after EndAll: %v", running)
	}
}

func TestRunningOnAHostWithoutTmuxIsEmpty(t *testing.T) {
	h := newFakeHarness(t)
	h.terminals.Missing = true

	running, err := h.svc.Running(context.Background())
	if err != nil || len(running) != 0 {
		t.Fatalf("running = %v, err = %v", running, err)
	}
}
