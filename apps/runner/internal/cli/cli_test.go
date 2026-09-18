package cli_test

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
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
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := cli.ExitCode(tc.err); got != tc.want {
				t.Fatalf("ExitCode = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestExitCodeUnwrapsAWrappedProblem(t *testing.T) {
	wrapped := problem.New("X", http.StatusBadGateway, "t").WithCause(errors.New("dial tcp"))

	if got := cli.ExitCode(wrapped); got != 6 {
		t.Fatalf("ExitCode = %d, want 6", got)
	}
}

func TestCredentialHelperSpeaksGitsProtocol(t *testing.T) {
	t.Setenv(cli.EnvHome, filepath.Join(t.TempDir(), ".oppenheimer"))
	app, err := cli.New("test")
	if err != nil {
		t.Fatal(err)
	}
	var out strings.Builder

	// No runner is listening on the socket, which is what a `git` run on a
	// host whose daemon is stopped looks like.
	err = app.CredentialHelper(context.Background(), "get",
		strings.NewReader("protocol=https\nhost=github.com\n\n"), &out)

	if err != nil {
		t.Fatalf("the helper must never fail a git command: %v", err)
	}
	if out.String() != "" {
		t.Fatalf("out = %q; an empty answer is git's \"I have no credentials\"", out.String())
	}
}

func TestCredentialHelperIgnoresStoreAndErase(t *testing.T) {
	t.Setenv(cli.EnvHome, filepath.Join(t.TempDir(), ".oppenheimer"))
	app, err := cli.New("test")
	if err != nil {
		t.Fatal(err)
	}

	for _, operation := range []string{"store", "erase"} {
		var out strings.Builder
		// The runner keeps no credential, so there is nothing to record or
		// forget — but git must never see an error for saying so.
		if err := app.CredentialHelper(context.Background(), operation,
			strings.NewReader("protocol=https\nhost=github.com\npassword=secret\n\n"), &out); err != nil {
			t.Fatalf("%s: %v", operation, err)
		}
		if out.String() != "" {
			t.Fatalf("%s wrote %q", operation, out.String())
		}
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
