package app_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/fake"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// An OpenCode session is launched serving its conversation on a port the
// runner found, and keeps where (and since when) on the session, so the chat
// can reach it after the runner restarts; a restart serves it on a fresh
// port with a fresh password, still since the session first launched.
// The password is the terminal's environment, never the launch line, which
// is the arguments of a wrapper as long-lived as the agent. Regression: a
// chat that cannot find OpenCode once the runner restarted, a restart that
// binds a port another process took meanwhile, a restart that forgets which
// conversations are the session's, or a password any account can read.
func TestAnOpenCodeSessionKeepsWhereItsConversationIsServed(t *testing.T) {
	h := newFakeHarness(t)
	ports := []int{41001, 41002}
	now := time.UnixMilli(1_700_000_000_000)
	svc, err := app.New(app.Options{
		Terminals: h.terminals, Worktrees: h.worktrees, Classifier: manifest.New(manifest.Options{}),
		Store: &memoryStore{}, Publisher: h.events, Files: h.files,
		Places: fake.NewPlaces(), Layout: domain.Layout{Root: "/home/jordi/oppenheimer"},
		FreePort: func() (int, error) {
			port := ports[0]
			ports = ports[1:]
			return port, nil
		},
		Now: func() time.Time { return now },
	})
	if err != nil {
		t.Fatal(err)
	}
	session, err := svc.Create(context.Background(), app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: "https://github.test/jordi/oppenheimer.git",
		BaseBranch: "main", Agent: domain.AgentOpenCode,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	created, _ := svc.Get(session.ID)
	first := created.Launch.Server
	if first == nil || first.Port != 41001 || first.Password == "" || first.Since != now.UnixMilli() || first.Directory != session.Cwd() {
		t.Fatalf("server = %+v, want port 41001 with a password, since the launch, in %s", first, session.Cwd())
	}
	command := h.terminals.Launches[session.Target(0)].Command
	if !strings.Contains(command, "--port 41001 --hostname 127.0.0.1") || strings.Contains(command, first.Password) {
		t.Fatalf("launched %q, want OpenCode serving on its port, its password off the line", command)
	}
	if env := h.terminals.Env(session.TmuxName()); env["OPENCODE_SERVER_PASSWORD"] != first.Password {
		t.Fatalf("terminal env = %v, want the password there", env)
	}

	if err := h.terminals.Kill(context.Background(), session.TmuxName()); err != nil {
		t.Fatal(err)
	}
	now = now.Add(time.Hour)
	if _, err := svc.Restart(context.Background(), session.ID); err != nil {
		t.Fatalf("restart: %v", err)
	}
	restarted, _ := svc.Get(session.ID)
	again := restarted.Launch.Server
	if again == nil || again.Port != 41002 || again.Password == first.Password || again.Since != first.Since {
		t.Fatalf("server after restart = %+v, want port 41002, a new password, the first launch's since", again)
	}
	if env := h.terminals.Env(session.TmuxName()); env["OPENCODE_SERVER_PASSWORD"] != again.Password {
		t.Fatalf("terminal env after restart = %v, want the new password", env)
	}
}
