package cli_test

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/cli"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

func TestResolvePathsKeepsTheUsersCodeOutOfTheRunnerHome(t *testing.T) {
	home := t.TempDir()
	t.Setenv(cli.EnvHome, filepath.Join(home, ".oppenheimer"))
	t.Setenv(cli.EnvWorkspaces, filepath.Join(home, "oppenheimer-ai", "workspaces"))

	paths, err := cli.ResolvePaths()
	if err != nil {
		t.Fatal(err)
	}
	// An uninstall may delete the runner home; it must never contain the
	// worktrees, which are the user's work.
	if rel, err := filepath.Rel(paths.Home, paths.Workspaces); err == nil && !filepath.IsAbs(rel) && rel[:2] != ".." {
		t.Fatalf("workspaces %q is inside the runner home %q", paths.Workspaces, paths.Home)
	}
	for name, got := range map[string]string{
		"bin":     paths.Bin(),
		"current": paths.Current(),
		"log":     paths.Log(),
		"socket":  paths.Socket(),
		"lock":    paths.Lock(),
		"state":   paths.State(),
	} {
		if rel, err := filepath.Rel(paths.Home, got); err != nil || rel == "." || rel[:2] == ".." {
			t.Fatalf("%s = %q, want it under the runner home", name, got)
		}
	}
}

func TestEnsureCreatesPrivateDirectories(t *testing.T) {
	home := t.TempDir()
	t.Setenv(cli.EnvHome, filepath.Join(home, ".oppenheimer"))
	paths, err := cli.ResolvePaths()
	if err != nil {
		t.Fatal(err)
	}

	if err := paths.Ensure(); err != nil {
		t.Fatal(err)
	}

	for _, dir := range []string{paths.Home, paths.Bin(), paths.Log(), paths.Run(), paths.State()} {
		info, err := os.Stat(dir)
		if err != nil {
			t.Fatalf("%s: %v", dir, err)
		}
		// Everything here is a secret, a binary or a log of what the user's
		// agent is doing. None of it is anyone else's business.
		if perm := info.Mode().Perm(); perm != 0o700 {
			t.Fatalf("%s is %#o, want 0700", dir, perm)
		}
	}
}

func TestLockRefusesASecondRunner(t *testing.T) {
	path := filepath.Join(t.TempDir(), "runner.lock")

	release, err := cli.Lock(path)
	if err != nil {
		t.Fatalf("first lock: %v", err)
	}

	// Two runners on one host would fight over the tmux server and the
	// worktrees; the second must fail rather than share.
	if _, err := cli.Lock(path); err == nil {
		t.Fatal("a second runner must not be able to take the lock")
	}

	release()
	release2, err := cli.Lock(path)
	if err != nil {
		t.Fatalf("lock after release: %v", err)
	}
	release2()
}

func TestExitCodeIsTheDocumentedContract(t *testing.T) {
	for _, tc := range []struct {
		name string
		err  error
		want int
	}{
		{"ok", nil, 0},
		{"plain failure", errors.New("boom"), 1},
		{"unauthorized", problem.New("X", http.StatusUnauthorized, "t"), 3},
		{"forbidden", problem.New("X", http.StatusForbidden, "t"), 4},
		{"not found", problem.New("X", http.StatusNotFound, "t"), 5},
		{"not paired", problem.New("X", http.StatusPreconditionRequired, "t"), 5},
		{"unreachable", problem.New("X", http.StatusBadGateway, "t"), 6},
		{"server error", problem.New("X", http.StatusInternalServerError, "t"), 1},
		{"wrapped problem", fmt.Errorf("register: %w", problem.New("X", http.StatusBadGateway, "t")), 6},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := cli.ExitCode(tc.err); got != tc.want {
				t.Fatalf("ExitCode = %d, want %d", got, tc.want)
			}
		})
	}
}

// No runner is listening on the socket, which is what a `git` run on a host
// whose daemon is stopped looks like. `get` then answers nothing, git's "I
// have no credentials"; `store` and `erase` are git reporting what it did,
// and the runner keeps nothing to record or forget. None of them may fail the
// git command.
func TestCredentialHelperNeverFailsGit(t *testing.T) {
	t.Setenv(cli.EnvHome, filepath.Join(t.TempDir(), ".oppenheimer"))
	app, err := cli.New("test")
	if err != nil {
		t.Fatal(err)
	}

	// git's `get` asks with no password; `store` and `erase` carry the one it
	// used.
	for _, tc := range []struct{ operation, stdin string }{
		{"get", "protocol=https\nhost=github.com\n\n"},
		{"store", "protocol=https\nhost=github.com\nusername=x\npassword=secret\n\n"},
		{"erase", "protocol=https\nhost=github.com\nusername=x\npassword=secret\n\n"},
	} {
		var out strings.Builder
		if err := app.CredentialHelper(context.Background(), tc.operation,
			strings.NewReader(tc.stdin), &out); err != nil {
			t.Fatalf("%s: %v", tc.operation, err)
		}
		if out.String() != "" {
			t.Fatalf("%s wrote %q; an empty answer is git's \"I have no credentials\"", tc.operation, out.String())
		}
	}
}

// An update is a symlink swap plus a restart: the installed unit has to run
// the `current` link, never a versioned binary, or every update would need a
// unit rewrite and a daemon-reload as well.
func TestTheServiceRunsTheCurrentLink(t *testing.T) {
	t.Setenv(cli.EnvHome, filepath.Join(t.TempDir(), ".oppenheimer"))
	app, err := cli.New("test")
	if err != nil {
		t.Fatal(err)
	}

	unit, _ := app.Service.Unit()

	if unit.ExecPath != app.Paths.Current() || len(unit.Args) != 1 || unit.Args[0] != "run" {
		t.Fatalf("unit runs %q %v, want %q run", unit.ExecPath, unit.Args, app.Paths.Current())
	}
}

func TestSelfCheckRunsWhileTheDaemonHoldsTheLock(t *testing.T) {
	t.Setenv(cli.EnvHome, filepath.Join(t.TempDir(), ".oppenheimer"))
	app, err := cli.New("test")
	if err != nil {
		t.Fatal(err)
	}
	// A staged binary runs `selfcheck` while the live daemon is running.
	// If it took the lock — or the socket, or the host key — the check
	// would be a worse failure than the one it exists to catch.
	release, err := cli.Lock(app.Paths.Lock())
	if err != nil {
		t.Fatal(err)
	}
	defer release()

	report, err := app.SelfCheck(context.Background())
	if err != nil {
		t.Fatalf("selfcheck must not need the lock: %v", err)
	}
	if !strings.Contains(string(report), "\"version\"") {
		t.Fatalf("report = %s", report)
	}
}

func workspacePaths(t *testing.T) cli.Paths {
	t.Helper()
	user := t.TempDir()
	paths := cli.Paths{Home: filepath.Join(user, ".oppenheimer"), UserHome: user}
	if err := os.MkdirAll(paths.Home, 0o700); err != nil {
		t.Fatal(err)
	}
	return paths
}

func TestChooseWorkspacesCreatesAPrivateDirectoryAndExpandsTheTilde(t *testing.T) {
	paths := workspacePaths(t)

	dir, warnings, err := cli.ChooseWorkspaces("~/code/oppenheimer", paths)
	if err != nil {
		t.Fatal(err)
	}
	want, _ := filepath.EvalSymlinks(filepath.Join(paths.UserHome, "code", "oppenheimer"))
	if dir != want || len(warnings) != 0 {
		t.Fatalf("dir = %q, warnings = %v", dir, warnings)
	}
	info, err := os.Stat(dir)
	if err != nil || info.Mode().Perm() != 0o700 {
		t.Fatalf("created %v with %v, want 0700", err, info)
	}
	// The search-index opt-out is the one thing choosing a directory leaves in
	// it, and only on macOS; the writability probe is not.
	entries, _ := os.ReadDir(dir)
	for _, entry := range entries {
		if entry.Name() == cli.IndexingOptOut && runtime.GOOS == "darwin" {
			continue
		}
		t.Fatalf("the writability probe was left behind: %v", entries)
	}
}

func TestChooseWorkspacesKeepsTheDirectoryOutOfTheSearchIndex(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("the marker is macOS's")
	}
	paths := workspacePaths(t)

	dir, _, err := cli.ChooseWorkspaces("~/code/oppenheimer", paths)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(filepath.Join(dir, cli.IndexingOptOut)); err != nil {
		t.Fatalf("a chosen workspace root is left to Spotlight: %v", err)
	}
}

func TestChooseWorkspacesRefusesWhatWouldHurt(t *testing.T) {
	paths := workspacePaths(t)
	for name, raw := range map[string]string{
		"relative":          "code/oppenheimer",
		"the home itself":   paths.UserHome,
		"the root":          "/",
		"inside the runner": filepath.Join(paths.Home, "workspaces"),
	} {
		_, _, err := cli.ChooseWorkspaces(raw, paths)
		var prob *problem.Error
		if !errors.As(err, &prob) || prob.Code != "HOST_007" {
			t.Errorf("%s: err = %v, want HOST_007", name, err)
		}
	}
	// A refusal leaves nothing behind in the runner's own directory.
	if _, err := os.Stat(filepath.Join(paths.Home, "workspaces")); !os.IsNotExist(err) {
		t.Fatal("a refused directory inside the runner home was created anyway")
	}
}

func TestChooseWorkspacesWarnsAboutASyncedFolder(t *testing.T) {
	paths := workspacePaths(t)

	_, warnings, err := cli.ChooseWorkspaces(filepath.Join(paths.UserHome, "Dropbox", "code"), paths)
	if err != nil {
		t.Fatal(err)
	}
	if len(warnings) != 1 || !strings.Contains(warnings[0], "synced folder") {
		t.Fatalf("warnings = %v", warnings)
	}
}

func TestServicePATHKeepsOnlyAbsoluteEntriesOnce(t *testing.T) {
	sep := string(os.PathListSeparator)
	in := strings.Join([]string{"/opt/homebrew/bin", "", ".", "bin", "/usr/bin", "/opt/homebrew/bin"}, sep)

	got := cli.ServicePATH(in)

	if want := "/opt/homebrew/bin" + sep + "/usr/bin"; got != want {
		t.Fatalf("ServicePATH = %q, want %q", got, want)
	}
}
