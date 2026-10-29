package app_test

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	filestore "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/files"
	gitadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/git"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/manifest"
	statestore "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/state"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/tmux"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/workfolder"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// These tests must run against the real tmux and the real git, because they
// are the claims the product rests on: a session is a worktree with a
// terminal, it survives the runner going away, and a pasted file reaches its
// shell. Everything else about the lifecycle is covered on the in-memory
// adapters next door.

type recorder struct {
	states    []domain.State
	decisions []*domain.Decision
	matches   []terminalMatch
}

// terminalMatch is one TerminalMatched report.
type terminalMatch struct {
	session, watch string
	count          int
}

func (r *recorder) TerminalMatched(sessionID, watchID string, count int) {
	r.matches = append(r.matches, terminalMatch{session: sessionID, watch: watchID, count: count})
}

func (r *recorder) SessionChanged(s domain.Session) { r.states = append(r.states, s.State) }

func (r *recorder) FirstPrompt(domain.Session, string, func()) bool { return true }

func (r *recorder) DecisionChanged(_ domain.Session, decision *domain.Decision) {
	r.decisions = append(r.decisions, decision)
}

// realHarness wires the service to this machine's tmux and git.
type realHarness struct {
	svc      *app.Service
	layout   domain.Layout
	terminal *tmux.Server
	store    *statestore.Store
	files    string
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
	files := t.TempDir()
	svc, err := app.New(app.Options{
		Terminals: terminal, Worktrees: gitadapter.New(gitadapter.Options{Layout: layout}),
		Classifier: manifest.New(manifest.Options{}), Store: store, Publisher: &recorder{}, Layout: layout,
		Places: workfolder.New(workfolder.Options{Layout: layout}),
		Files:  filestore.New(files),
		Env: func(s domain.Session) map[string]string {
			return map[string]string{"OPPENHEIMER_SESSION": s.ID}
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return &realHarness{svc: svc, layout: layout, terminal: terminal, store: store, files: files, remote: origin(t)}
}

// requireWorkingTmux skips unless a tmux server can actually be started; why
// PATH is not enough, and why the probe gets its own socket: `server` in
// adapters/tmux/tmux_test.go.
func requireWorkingTmux(t *testing.T) string {
	t.Helper()
	if _, err := exec.LookPath("tmux"); err != nil {
		t.Skip("tmux is not installed")
	}
	probe := "opp-probe-" + strings.ReplaceAll(t.Name(), "/", "-")
	if out, err := exec.Command("tmux", "-L", probe, "start-server").CombinedOutput(); err != nil {
		t.Skipf("tmux cannot start a server here (%s): %v", strings.TrimSpace(string(out)), err)
	}
	_ = exec.Command("tmux", "-L", probe, "kill-server").Run() //nolint:errcheck // best effort
	socket := "opp-it-" + strings.ReplaceAll(t.Name(), "/", "-")
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
	// The work folder's layout (24 §2): the CLI's own levels, the session's
	// folder with its marker, the checkout in it, and a bare store beside.
	if want := filepath.Join(session.Dir, "oppenheimer"); session.Worktree != want {
		t.Fatalf("worktree = %q, want %q", session.Worktree, want)
	}
	if filepath.Dir(session.Dir) != h.layout.Sessions(domain.LocalTenant) {
		t.Fatalf("session folder %q is not in %q", session.Dir, h.layout.Sessions(domain.LocalTenant))
	}
	if _, err := os.Stat(filepath.Join(session.Dir, ".oppenheimer", "meta.json")); err != nil {
		t.Fatalf("the session's folder has no marker: %v", err)
	}
	if _, err := os.Stat(filepath.Join(h.layout.Store(session.Repository()), "HEAD")); err != nil {
		t.Fatalf("no bare store beside the sessions: %v", err)
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
	if _, err := os.Stat(session.Dir); !os.IsNotExist(err) {
		t.Fatal("the session's folder is still on disk")
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
		Places: workfolder.New(workfolder.Options{Layout: h.layout}),
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

// A file pasted into a real shell session: the file is on disk, private,
// outside the worktree, and its path sits on the prompt line — pasted, not
// run — until the session closes and takes the file with it.
func TestARealSessionTakesAPastedImage(t *testing.T) {
	h := newRealHarness(t)
	ctx := context.Background()
	session, err := h.svc.Create(ctx, app.CreateInput{
		Repo: "jordi/oppenheimer", Remote: h.remote, BaseBranch: "main", Agent: domain.AgentShell,
	})
	if err != nil {
		t.Fatal(err)
	}
	png := []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
	const command = "7d9f2c1e-3b4a-4f6e-8a9b-0c1d2e3f4a5b"

	path, err := h.svc.PasteFile(ctx, session.ID, 0, command, "image/png", png)
	if err != nil {
		t.Fatal(err)
	}

	if !strings.HasPrefix(path, h.files) || strings.HasPrefix(path, session.Worktree) {
		t.Fatalf("path = %q: under the runner's files, never the worktree", path)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("mode = %v, want 0600", info.Mode().Perm())
	}
	// The pane is 80 columns and a path is longer, so the capture wraps it:
	// joined, the screen must hold the path, and a pasted path is not run.
	var screen string
	for i := 0; i < 100 && !strings.Contains(screen, path); i++ {
		captured, _ := h.terminal.Capture(ctx, session.Target(0))
		screen = strings.ReplaceAll(captured.Body, "\n", "")
		time.Sleep(50 * time.Millisecond)
	}
	if !strings.Contains(screen, path) {
		t.Fatalf("the path never reached the prompt:\n%s", screen)
	}
	if strings.Contains(screen, "No such file") || strings.Contains(screen, "Permission denied") {
		t.Fatalf("the shell ran the pasted path instead of holding it:\n%s", screen)
	}

	if _, err := h.svc.Close(ctx, session.ID, app.CloseInput{Force: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Dir(path)); !os.IsNotExist(err) {
		t.Fatalf("closing kept the session's files: %v", err)
	}
}

// A folder session runs in a folder that is the person's (24 §3): the agent
// starts there, nothing is written into it, and closing the session ends the
// terminal and leaves the folder exactly as it was — no marker, no checkout,
// nothing removed.
func TestARealFolderSessionLeavesItsFolderAlone(t *testing.T) {
	h := newRealHarness(t)
	ctx := context.Background()
	folder := t.TempDir()
	if err := os.WriteFile(filepath.Join(folder, "notes.txt"), []byte("mine\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	before := listing(t, folder)

	session, err := h.svc.Create(ctx, app.CreateInput{Folder: folder, Agent: domain.AgentShell})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if session.Place != domain.PlaceFolder || session.Cwd() != folder || session.Worktree != "" || session.Dir != "" {
		t.Fatalf("session = %+v", session)
	}
	if has, err := h.terminal.Has(ctx, session.TmuxName()); err != nil || !has {
		t.Fatalf("the tmux session is not there: %v", err)
	}
	if after := listing(t, folder); after != before {
		t.Fatalf("creating wrote into the folder: %q, was %q", after, before)
	}

	closed, err := h.svc.Close(ctx, session.ID, app.CloseInput{Push: true})
	if err != nil {
		t.Fatalf("close: %v", err)
	}
	if closed.State != domain.StateClosed {
		t.Fatalf("state = %q", closed.State)
	}
	if has, _ := h.terminal.Has(ctx, session.TmuxName()); has {
		t.Fatal("the tmux session outlived the close")
	}
	if after := listing(t, folder); after != before {
		t.Fatalf("closing touched the folder: %q, was %q", after, before)
	}
	if entries, _ := os.ReadDir(h.layout.Root); len(entries) != 0 {
		t.Fatalf("a folder session made something in the work folder: %v", entries)
	}
}

// listing is a folder's entries, names and sizes, to compare before and after.
func listing(t *testing.T, dir string) string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			t.Fatal(err)
		}
		out = append(out, entry.Name()+":"+info.Mode().String()+":"+strconv.FormatInt(info.Size(), 10))
	}
	return strings.Join(out, ",")
}
