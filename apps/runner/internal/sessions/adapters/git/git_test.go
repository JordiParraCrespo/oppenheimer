package git_test

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	gitadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/git"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// origin builds a bare repository with one commit on `main`, standing in for
// GitHub. Everything below then goes through the same code paths a real host
// would: clone, fetch, worktree add, push.
func origin(t *testing.T) string {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git is not installed")
	}
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
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return string(out)
}

func client(t *testing.T) (*gitadapter.Client, domain.Layout) {
	t.Helper()
	layout := domain.Layout{Root: t.TempDir()}
	return gitadapter.New(gitadapter.Options{Layout: layout}), layout
}

const repo = "jordi/oppenheimer"

func TestEnsureClonesThenFetches(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()

	if err := c.Ensure(ctx, repo, remote); err != nil {
		t.Fatalf("first ensure (clone): %v", err)
	}
	if _, err := os.Stat(filepath.Join(layout.Mirror(repo), ".git")); err != nil {
		t.Fatalf("the mirror is not there: %v", err)
	}

	// The second call fetches, and needs no remote: the host already knows
	// where the repository came from.
	if err := c.Ensure(ctx, repo, ""); err != nil {
		t.Fatalf("second ensure (fetch): %v", err)
	}
}

func TestEnsureRefusesARepositoryItHasNeverSeenWithNoRemote(t *testing.T) {
	c, _ := client(t)

	err := c.Ensure(context.Background(), repo, "")

	var prob *problem.Error
	if !isProblem(err, &prob, "GIT_001") {
		t.Fatalf("err = %v, want GIT_001", err)
	}
}

func TestEnsureRefusesARepositoryNameThatWouldEscapeTheLayout(t *testing.T) {
	c, _ := client(t)

	for _, name := range []string{"../../etc", "owner/../../etc", "not-a-repo"} {
		if err := c.Ensure(context.Background(), name, "https://example.test/x.git"); err == nil {
			t.Fatalf("%q must not be accepted as a repository name", name)
		}
	}
}

func TestAddCutsANewBranchFromTheBaseAndRemoveTakesItAway(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote); err != nil {
		t.Fatal(err)
	}
	worktree := layout.Worktree(repo, "session-abc")

	if err := c.Add(ctx, repo, worktree, "oppenheimer/abc", "main", true); err != nil {
		t.Fatalf("add: %v", err)
	}

	if _, err := os.Stat(filepath.Join(worktree, "README.md")); err != nil {
		t.Fatalf("the worktree has no files: %v", err)
	}
	branch := strings.TrimSpace(git(t, worktree, "rev-parse", "--abbrev-ref", "HEAD"))
	if branch != "oppenheimer/abc" {
		t.Fatalf("branch = %q", branch)
	}

	if err := c.Remove(ctx, repo, worktree, false); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if _, err := os.Stat(worktree); !os.IsNotExist(err) {
		t.Fatal("the worktree is still on disk")
	}
}

func TestAddRefusesToReuseAPathThatExists(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote); err != nil {
		t.Fatal(err)
	}
	worktree := layout.Worktree(repo, "taken")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/one", "main", true); err != nil {
		t.Fatal(err)
	}

	err := c.Add(ctx, repo, worktree, "oppenheimer/two", "main", true)

	var prob *problem.Error
	if !isProblem(err, &prob, "SESS_004") {
		t.Fatalf("err = %v, want SESS_004", err)
	}
}

func TestDirtyAndPush(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote); err != nil {
		t.Fatal(err)
	}
	worktree := layout.Worktree(repo, "session-push")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/push", "main", true); err != nil {
		t.Fatal(err)
	}
	git(t, worktree, "config", "user.email", "test@example.com")
	git(t, worktree, "config", "user.name", "Test")

	if dirty, err := c.Dirty(ctx, worktree); err != nil || dirty {
		t.Fatalf("a fresh worktree is clean: dirty = %v, err = %v", dirty, err)
	}

	if err := os.WriteFile(filepath.Join(worktree, "work.txt"), []byte("in progress\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if dirty, err := c.Dirty(ctx, worktree); err != nil || !dirty {
		t.Fatalf("an edited worktree is dirty: dirty = %v, err = %v", dirty, err)
	}

	git(t, worktree, "add", ".")
	git(t, worktree, "commit", "-m", "session work")
	pushed, err := c.Push(ctx, worktree, "oppenheimer/push")
	if err != nil || !pushed {
		t.Fatalf("push = %v, err = %v", pushed, err)
	}
	if !strings.Contains(git(t, "", "--git-dir", remote, "branch", "--list"), "oppenheimer/push") {
		t.Fatal("the branch never reached the remote")
	}

	// Pushing again with nothing new is not an error and not a push.
	pushed, err = c.Push(ctx, worktree, "oppenheimer/push")
	if err != nil || pushed {
		t.Fatalf("second push = %v, err = %v; want nothing to do", pushed, err)
	}
}

func TestGitNeverWaitsForAPassword(t *testing.T) {
	c, _ := client(t)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// A remote that cannot be reached must fail fast, not hang a session
	// create. What it is classified as is pinned against a remote that does
	// answer, in recovery_test.go.
	err := c.Ensure(ctx, repo, "https://127.0.0.1:1/private.git")

	if err == nil || ctx.Err() != nil {
		t.Fatalf("err = %v, ctx = %v; want a prompt failure, not a wait", err, ctx.Err())
	}
}

func isProblem(err error, target **problem.Error, code string) bool {
	if err == nil {
		return false
	}
	if !asProblem(err, target) {
		return false
	}
	return (*target).Code == code
}

func asProblem(err error, target **problem.Error) bool {
	for err != nil {
		if prob, ok := err.(*problem.Error); ok { //nolint:errorlint // the chain is walked by hand below
			*target = prob
			return true
		}
		unwrapper, ok := err.(interface{ Unwrap() error })
		if !ok {
			return false
		}
		err = unwrapper.Unwrap()
	}
	return false
}
