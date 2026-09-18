package app_test

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	gitadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/git"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	statestore "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/state"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/tmux"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

const repo = "jordi/oppenheimer"

// harness is the session service on the real tmux and the real git of this
// machine, against a bare repository standing in for GitHub. The lifecycle is
// the product, so it is exercised against the tools it will actually drive.
type harness struct {
	svc      *app.Service
	layout   domain.Layout
	terminal *tmux.Server
	store    *statestore.Store
	remote   string
	events   *recorder
}

type recorder struct{ states []domain.State }

func (r *recorder) SessionChanged(s domain.Session) { r.states = append(r.states, s.State) }

func newHarness(t *testing.T) *harness {
	t.Helper()
	for _, tool := range []string{"tmux", "git"} {
		if _, err := exec.LookPath(tool); err != nil {
			t.Skipf("%s is not installed", tool)
		}
	}
	socket := "opp-life-" + strings.ReplaceAll(t.Name(), "/", "-")
	terminal, err := tmux.New(tmux.Options{Socket: socket, ConfigPath: filepath.Join(t.TempDir(), "tmux.conf")})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = exec.Command("tmux", "-L", socket, "kill-server").Run() }) //nolint:errcheck // best effort

	layout := domain.Layout{Root: t.TempDir()}
	store := statestore.New(t.TempDir())
	events := &recorder{}
	svc, err := app.New(app.Options{
		Terminals: terminal, Worktrees: gitadapter.New(gitadapter.Options{Layout: layout}),
		Classifier: manifest.New(), Store: store, Publisher: events, Layout: layout,
		Env: func(s domain.Session) map[string]string {
			return map[string]string{"OPPENHEIMER_SESSION": s.ID}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return &harness{svc: svc, layout: layout, terminal: terminal, store: store, remote: origin(t), events: events}
}

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

// git runs a git command in dir and fails the test if it does not work; the
// fixtures below are built with real git so the adapter is exercised against
// the tool it actually drives.
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

func (h *harness) create(t *testing.T) domain.Session {
	t.Helper()
	session, err := h.svc.Create(context.Background(), app.CreateInput{
		Repo: repo, Remote: h.remote, BaseBranch: "main", Agent: domain.AgentShell,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return session
}

func TestCreateMakesAWorktreeATmuxSessionAndAWindow(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	session := h.create(t)

	if session.State != domain.StateStarting || len(session.Windows) != 1 || !session.Windows[0].Agent {
		t.Fatalf("session = %+v", session)
	}
	if _, err := os.Stat(filepath.Join(session.Worktree, "README.md")); err != nil {
		t.Fatalf("the worktree has no files: %v", err)
	}
	if !strings.HasPrefix(session.Branch, "oppenheimer/") {
		t.Fatalf("branch = %q, want a session branch by default", session.Branch)
	}
	if has, err := h.terminal.Has(ctx, session.TmuxName()); err != nil || !has {
		t.Fatalf("the tmux session is not there: %v", err)
	}
	// The session id is in the tmux environment, so a credential helper
	// called from any tab knows which session it is answering for.
	if err := h.terminal.SendKeys(ctx, session.Target(0), "printf '[%s]' \"$OPPENHEIMER_SESSION\"\n"); err != nil {
		t.Fatal(err)
	}
	if screen := waitFor(t, h, session.Target(0), "["+session.ID+"]"); !strings.Contains(screen, session.ID) {
		t.Fatalf("the session environment is not in the shell:\n%s", screen)
	}
}

func TestTheSessionMapSurvivesARunnerRestart(t *testing.T) {
	h := newHarness(t)
	session := h.create(t)

	// A new service on the same files is what a restarted runner is.
	restarted, err := app.New(app.Options{
		Terminals: h.terminal, Worktrees: gitadapter.New(gitadapter.Options{Layout: h.layout}),
		Classifier: manifest.New(), Store: h.store, Layout: h.layout,
	})
	if err != nil {
		t.Fatal(err)
	}

	adopted, err := restarted.Adopt(context.Background())
	if err != nil {
		t.Fatalf("adopt: %v", err)
	}
	if len(adopted) != 1 || adopted[0].ID != session.ID {
		t.Fatalf("adopted = %+v", adopted)
	}
	// This is the promise the whole product rests on: the runner went away
	// and came back, and the session is still there.
	if !adopted[0].State.Live() {
		t.Fatalf("state = %q, want a live session", adopted[0].State)
	}
}

func TestASessionWhoseTmuxIsGoneIsStoppedNotLost(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	session := h.create(t)

	// What a host reboot looks like: tmux is gone, the worktree is not.
	if err := h.terminal.Kill(ctx, session.TmuxName()); err != nil {
		t.Fatal(err)
	}

	refreshed, err := h.svc.Refresh(ctx, session.ID)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if refreshed.State != domain.StateStopped {
		t.Fatalf("state = %q, want stopped", refreshed.State)
	}
	if _, err := os.Stat(refreshed.Worktree); err != nil {
		t.Fatalf("the worktree must survive: %v", err)
	}

	// And Restart brings it back in the same worktree.
	restarted, err := h.svc.Restart(ctx, session.ID)
	if err != nil {
		t.Fatalf("restart: %v", err)
	}
	if !restarted.State.Live() || restarted.Worktree != session.Worktree {
		t.Fatalf("restarted = %+v", restarted)
	}
}

func TestTabsAreWindowsAndWindowZeroIsNotATab(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	session := h.create(t)

	window, err := h.svc.OpenWindow(ctx, session.ID)
	if err != nil {
		t.Fatalf("open window: %v", err)
	}
	if window.Index == 0 {
		t.Fatal("a tab is never window 0")
	}

	if err := h.svc.CloseWindow(ctx, session.ID, 0); err == nil {
		t.Fatal("window 0 is the agent; closing it is closing the session")
	}
	if err := h.svc.CloseWindow(ctx, session.ID, window.Index); err != nil {
		t.Fatalf("close window: %v", err)
	}
	after, _ := h.svc.Get(session.ID)
	if len(after.Windows) != 1 {
		t.Fatalf("windows = %+v", after.Windows)
	}
}

func TestClosePushesTheBranchAndRemovesTheWorktree(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	session := h.create(t)

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

func TestCloseKeepsAWorktreeWithUncommittedWork(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	session := h.create(t)
	if err := os.WriteFile(filepath.Join(session.Worktree, "unsaved.txt"), []byte("half a thought\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	kept, err := h.svc.Close(ctx, session.ID, app.CloseInput{Push: true})

	// The runner commits nothing on a person's behalf and deletes nothing
	// they have not saved: it says so and leaves the worktree.
	var prob *problem.Error
	if !errors.As(err, &prob) || prob.Code != "GIT_003" {
		t.Fatalf("err = %v, want GIT_003", err)
	}
	if !kept.Dirty || kept.State != domain.StateStopped {
		t.Fatalf("session = %+v", kept)
	}
	if _, statErr := os.Stat(filepath.Join(session.Worktree, "unsaved.txt")); statErr != nil {
		t.Fatalf("the unsaved work is gone: %v", statErr)
	}

	// --force is how a person says they meant it.
	forced, err := h.svc.Close(ctx, session.ID, app.CloseInput{Force: true})
	if err != nil {
		t.Fatalf("forced close: %v", err)
	}
	if forced.State != domain.StateClosed {
		t.Fatalf("state = %q", forced.State)
	}
}

func TestRefreshReadsTheScreenAndPublishesTheChange(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	session := h.create(t)

	// A shell sitting at its prompt is idle.
	if err := h.terminal.SendKeys(ctx, session.Target(0), "clear\n"); err != nil {
		t.Fatal(err)
	}
	waitFor(t, h, session.Target(0), "$")

	refreshed, err := h.svc.Refresh(ctx, session.ID)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if refreshed.State == domain.StateStarting {
		t.Fatal("refresh must move the state off starting once the screen says something")
	}
	if len(h.events.states) == 0 {
		t.Fatal("a state change is published, so the control plane can derive the sidebar")
	}
}

func TestCreateRejectsInputThatWouldEscapeTheLayout(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()

	for name, in := range map[string]app.CreateInput{
		"repository":  {Repo: "../../etc", Remote: h.remote},
		"branch":      {Repo: repo, Remote: h.remote, Branch: "../../../etc/passwd"},
		"base branch": {Repo: repo, Remote: h.remote, BaseBranch: "..\\..\\evil"},
		"agent":       {Repo: repo, Remote: h.remote, Agent: domain.Agent("rm -rf /")},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := h.svc.Create(ctx, in)
			var prob *problem.Error
			if !errors.As(err, &prob) || prob.Code != "SESS_002" {
				t.Fatalf("err = %v, want SESS_002", err)
			}
		})
	}
}

func TestOrphansAreOnlyOurOwnUnclaimedSessions(t *testing.T) {
	h := newHarness(t)
	ctx := context.Background()
	h.create(t)
	// A tmux session a person started themselves, on our socket.
	if err := h.terminal.Create(ctx, "my-own-work", t.TempDir(), "", nil); err != nil {
		t.Fatal(err)
	}
	// One of ours that no record claims — a crash between create and save.
	if err := h.terminal.Create(ctx, domain.Prefix+"leftover", t.TempDir(), "", nil); err != nil {
		t.Fatal(err)
	}

	orphans, err := h.svc.Orphans(ctx)
	if err != nil {
		t.Fatal(err)
	}

	if len(orphans) != 1 || orphans[0] != domain.Prefix+"leftover" {
		t.Fatalf("orphans = %v; a session the user started is never one", orphans)
	}
}

func waitFor(t *testing.T, h *harness, target, want string) string {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	var screen string
	for time.Now().Before(deadline) {
		screen, _ = h.terminal.Capture(context.Background(), target)
		if strings.Contains(screen, want) {
			return screen
		}
		time.Sleep(50 * time.Millisecond)
	}
	return screen
}
