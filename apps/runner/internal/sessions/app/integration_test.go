package app_test

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	gitadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/git"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	statestore "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/state"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/tmux"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// These two tests are the ones that must run against the real tmux and the
// real git, because they are the claims the product rests on: a session is a
// worktree with a terminal, and it survives the runner going away. Everything
// else about the lifecycle is covered on the in-memory adapters next door.

type recorder struct{ states []domain.State }

func (r *recorder) SessionChanged(s domain.Session) { r.states = append(r.states, s.State) }

// realHarness wires the service to this machine's tmux and git.
type realHarness struct {
	svc      *app.Service
	layout   domain.Layout
	terminal *tmux.Server
	store    *statestore.Store
	remote   string
}

func newRealHarness(t *testing.T) *realHarness {
	t.Helper()
	socket := requireWorkingTmux(t)
	requireGit(t)

	terminal, err := tmux.New(tmux.Options{Socket: socket, ConfigPath: filepath.Join(t.TempDir(), "tmux.conf")})
	if err != nil {
		t.Fatal(err)
	}
	layout := domain.Layout{Root: t.TempDir()}
	store := statestore.New(t.TempDir())
	svc, err := app.New(app.Options{
		Terminals: terminal, Worktrees: gitadapter.New(gitadapter.Options{Layout: layout}),
		Classifier: manifest.New(manifest.Options{}), Store: store, Publisher: &recorder{}, Layout: layout,
		Env: func(s domain.Session) map[string]string {
			return map[string]string{"OPPENHEIMER_SESSION": s.ID}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return &realHarness{svc: svc, layout: layout, terminal: terminal, store: store, remote: origin(t)}
}

// requireWorkingTmux skips unless a tmux server can actually be started.
// Checking PATH is not enough: a container without a usable pty layer has the
// binary and cannot fork a server, and that is the environment's problem, not
// this package's.
func requireWorkingTmux(t *testing.T) string {
	t.Helper()
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux is not installed")
	}
	socket := "opp-it-" + strings.ReplaceAll(t.Name(), "/", "-")
	if out, err := exec.Command("tmux", "-L", socket, "start-server").CombinedOutput(); err != nil {
		t.Skipf("tmux cannot start a server here (%s): %v", strings.TrimSpace(string(out)), err)
	}
	t.Cleanup(func() { _ = exec.Command("tmux", "-L", socket, "kill-server").Run() }) //nolint:errcheck // best effort
	return socket
}

func requireGit(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}
}

// origin builds a bare repository with one commit on main, standing in for
// GitHub.
func origin(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	bare := filepath.Join(root, "origin.git")
	work := filepath.Join(root, "seed")
	git(t, "", "init", "--bare", "-b", "main", bare)
	git(t, "", "init", "-b", "main", work)
	git(t, work, "config", "user.email", "test@example.com")
	git(t, work, "config", "user.name", "Test")
	if err := os.WriteFile(filepath.Join(work, "README.md"), []byte("# seed\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	git(t, work, "add", ".")
	git(t, work, "commit", "-m", "seed")
	git(t, work, "remote", "add", "origin", bare)
	git(t, work, "push", "-u", "origin", "main")
	return bare
}

func git(t *testing.T, dir string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return string(out)
}

func TestARealSessionIsAWorktreeWithATerminal(t *testing.T) {
	h := newRealHarness(t)
	ctx := context.Background()

	session, err := h.svc.Create(ctx, app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: h.remote, BaseBranch: "main", Agent: domain.AgentShell,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	if _, err := os.Stat(filepath.Join(session.Worktree, "README.md")); err != nil {
		t.Fatalf("the worktree has no files: %v", err)
	}
	if has, err := h.terminal.Has(ctx, session.TmuxName()); err != nil || !has {
		t.Fatalf("the tmux session is not there: %v", err)
	}

	// Work happens, and closing publishes it and takes the worktree away.
	git(t, session.Worktree, "config", "user.email", "test@example.com")
	git(t, session.Worktree, "config", "user.name", "Test")
	if err := os.WriteFile(filepath.Join(session.Worktree, "work.txt"), []byte("done\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	git(t, session.Worktree, "add", ".")
	git(t, session.Worktree, "commit", "-m", "session work")

	closed, err := h.svc.Close(ctx, session.ID, app.CloseInput{Push: true})
	if err != nil {
		t.Fatalf("close: %v", err)
	}
	if closed.State != domain.StateClosed {
		t.Fatalf("state = %q", closed.State)
	}
	if _, err := os.Stat(session.Worktree); !os.IsNotExist(err) {
		t.Fatal("the worktree is still on disk")
	}
	if has, _ := h.terminal.Has(ctx, session.TmuxName()); has {
		t.Fatal("the tmux session outlived the close")
	}
	if !strings.Contains(git(t, "", "--git-dir", h.remote, "branch", "--list"), session.Branch) {
		t.Fatal("the branch never reached the remote")
	}
}

func TestARealSessionSurvivesTheRunnerGoingAway(t *testing.T) {
	h := newRealHarness(t)
	ctx := context.Background()
	session, err := h.svc.Create(ctx, app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: h.remote, BaseBranch: "main", Agent: domain.AgentShell,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	// A second service on the same files is what a restarted — or updated,
	// or rolled back — runner is. The tmux server never went away.
	restarted, err := app.New(app.Options{
		Terminals: h.terminal, Worktrees: gitadapter.New(gitadapter.Options{Layout: h.layout}),
		Classifier: manifest.New(manifest.Options{}), Store: h.store, Layout: h.layout,
	})
	if err != nil {
		t.Fatal(err)
	}

	adopted, err := restarted.Adopt(ctx)
	if err != nil {
		t.Fatalf("adopt: %v", err)
	}
	if len(adopted) != 1 || adopted[0].ID != session.ID || !adopted[0].State.Live() {
		t.Fatalf("adopted = %+v", adopted)
	}
	if _, err := os.Stat(filepath.Join(session.Worktree, "README.md")); err != nil {
		t.Fatalf("the worktree went with the runner: %v", err)
	}
}
