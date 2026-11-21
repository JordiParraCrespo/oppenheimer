package app_test

import (
	"context"
	"slices"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func newWrappedService(t *testing.T) (*app.Service, *fake.Wrappers) {
	t.Helper()
	wrappers := fake.NewWrappers()
	svc, err := app.New(app.Options{
		Terminals: fake.NewTerminals(), Worktrees: fake.NewWorktrees(), Classifier: manifest.New(manifest.Options{}),
		Store: &memoryStore{}, Files: fake.NewFiles(), Places: fake.NewPlaces(),
		Layout: domain.Layout{Root: "/home/jordi/oppenheimer"}, Wrappers: wrappers,
	})
	if err != nil {
		t.Fatal(err)
	}
	return svc, wrappers
}

func openWrapped(t *testing.T, svc *app.Service) domain.Session {
	t.Helper()
	session, err := svc.Create(context.Background(), app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentClaude,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return session
}

// Closing a session ends the agent's wrapper, not only the tmux session:
// `state: closed` means nothing of it runs. It broke when Close stopped at
// `kill-session`, whose hangup an agent can ignore.
func TestCloseEndsTheAgentsWrapper(t *testing.T) {
	svc, wrappers := newWrappedService(t)
	session, other := openWrapped(t, svc), openWrapped(t, svc)
	wrappers.Start(app.Wrapper{SessionID: session.ID, Pid: 101, Group: 102})
	wrappers.Start(app.Wrapper{SessionID: other.ID, Pid: 201, Group: 202})

	if _, err := svc.Close(context.Background(), session.ID, app.CloseInput{}); err != nil {
		t.Fatal(err)
	}

	if got := wrappers.EndedSessions(); !slices.Equal(got, []string{session.ID}) {
		t.Fatalf("ended %v, want only the closed session's wrapper", got)
	}
}

// The safety net ends the wrapper of a session that is over (closed here
// while its agent kept running, as v0.1.16 left ~110 of them) and one whose
// tmux session is gone, and leaves a live session's wrapper alone. It broke
// with nothing to come round for them: they ran for days.
func TestStrayWrappersOfSessionsThatAreOverAreEnded(t *testing.T) {
	svc, wrappers := newWrappedService(t)
	live, closed := openWrapped(t, svc), openWrapped(t, svc)
	if _, err := svc.Close(context.Background(), closed.ID, app.CloseInput{}); err != nil {
		t.Fatal(err)
	}
	wrappers.Start(app.Wrapper{SessionID: live.ID, Pid: 101, Group: 102})
	wrappers.Start(app.Wrapper{SessionID: closed.ID, Pid: 201, Group: 202})
	// No record and no tmux session: what a create that failed halfway, or
	// a session map lost to a reinstall, leaves running.
	wrappers.Start(app.Wrapper{SessionID: "lost-otter-1abc", Pid: 301, Group: 302})

	ended, err := svc.EndStrayWrappers(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	want := []string{closed.ID, "lost-otter-1abc"}
	slices.Sort(want)
	if got := wrappers.EndedSessions(); !slices.Equal(got, want) {
		t.Fatalf("ended %v, want %v", got, want)
	}
	if len(ended) != 2 {
		t.Fatalf("answered %v, want the two it ended", ended)
	}
	if running, _ := wrappers.Running(context.Background()); len(running) != 1 || running[0].SessionID != live.ID {
		t.Fatalf("still running %v, want the live session's wrapper", running)
	}
}
