package git_test

import (
	"context"
	"net/http"
	"net/http/cgi"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	gitadapter "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/git"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

const (
	privateUser  = "x-access-token"
	privateToken = "ghs_test-token"
	sessionID    = "2ec946ef-7204-46ce-a722-6fa5904b371e"
)

// privateOrigin serves origin(t) over git's smart HTTP protocol behind basic
// auth, as GitHub serves a private repository: nothing is readable without
// the token. It returns the clone URL.
func privateOrigin(t *testing.T) string {
	t.Helper()
	bare := origin(t)
	gitPath, err := exec.LookPath("git")
	if err != nil {
		t.Skip("git is not installed")
	}
	git(t, "", "--git-dir", bare, "config", "http.receivepack", "true")
	backend := &cgi.Handler{
		Path: gitPath,
		Args: []string{"http-backend"},
		Env:  []string{"GIT_PROJECT_ROOT=" + filepath.Dir(bare), "GIT_HTTP_EXPORT_ALL=1"},
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != privateUser || pass != privateToken {
			w.Header().Set("WWW-Authenticate", `Basic realm="GitHub"`)
			http.Error(w, "authentication required", http.StatusUnauthorized)
			return
		}
		backend.ServeHTTP(w, r)
	}))
	t.Cleanup(server.Close)
	return server.URL + "/" + filepath.Base(bare)
}

// helper writes a stand-in for the runner's credential helper: it records
// the session git's environment named, and answers with the token only for
// the session the control plane would grant it to — which is what the real
// broker does.
func helper(t *testing.T) (command, seen string) {
	t.Helper()
	dir := t.TempDir()
	seen = filepath.Join(dir, "seen")
	script := filepath.Join(dir, "helper")
	body := "#!/bin/sh\n" +
		"[ \"$1\" = get ] || exit 0\n" +
		"cat >/dev/null\n" +
		"printf '%s\\n' \"$" + gitadapter.SessionEnv + "\" >> '" + seen + "'\n" +
		"[ \"$" + gitadapter.SessionEnv + "\" = '" + sessionID + "' ] || exit 0\n" +
		"printf 'username=" + privateUser + "\\npassword=" + privateToken + "\\n'\n"
	if err := os.WriteFile(script, []byte(body), 0o700); err != nil { //nolint:gosec // a test helper must be executable
		t.Fatal(err)
	}
	return script, seen
}

func privateClient(t *testing.T) (*gitadapter.Client, domain.Layout, string) {
	t.Helper()
	command, seen := helper(t)
	layout := domain.Layout{Root: t.TempDir()}
	return gitadapter.New(gitadapter.Options{Layout: layout, CredentialHelper: command}), layout, seen
}

func TestEnsureClonesAPrivateRepositoryForTheSessionItIsFor(t *testing.T) {
	remote := privateOrigin(t)
	c, layout, seen := privateClient(t)
	ctx := context.Background()

	if err := c.Ensure(ctx, repo, remote, sessionID); err != nil {
		t.Fatalf("clone of a private repository for a session: %v", err)
	}
	if _, err := os.Stat(filepath.Join(layout.Mirror(repo), ".git")); err != nil {
		t.Fatalf("the mirror is not there: %v", err)
	}
	asked, _ := os.ReadFile(seen)
	if !strings.Contains(string(asked), sessionID) {
		t.Fatalf("the helper was asked for %q, want the session id", asked)
	}

	// The fetch that follows needs the credential just as much.
	if err := c.Ensure(ctx, repo, "", sessionID); err != nil {
		t.Fatalf("fetch of a private repository for a session: %v", err)
	}

	// And so does the push when the session closes.
	worktree := layout.Worktree(repo, "session-private")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/private", "main", true); err != nil {
		t.Fatal(err)
	}
	git(t, worktree, "-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "--allow-empty", "-m", "work")
	if pushed, err := c.Push(ctx, worktree, "oppenheimer/private", sessionID); err != nil || !pushed {
		t.Fatalf("push = %v, err = %v", pushed, err)
	}
}

func TestEnsureSaysWhatIsMissingWhenAPrivateCloneHasNoCredential(t *testing.T) {
	remote := privateOrigin(t)
	c, layout, _ := privateClient(t)

	for _, session := range []string{"", "a-session-the-control-plane-refuses"} {
		err := c.Ensure(context.Background(), repo, remote, session)

		var prob *problem.Error
		if !isProblem(err, &prob, "GIT_004") {
			t.Fatalf("session %q: err = %v, want GIT_004", session, err)
		}
		if strings.Contains(prob.Detail, "could not read Username") {
			t.Fatalf("the detail relays git's prompt, which nobody was shown: %s", prob.Detail)
		}
		if !strings.Contains(prob.Detail, repo) {
			t.Fatalf("the detail does not name the repository: %s", prob.Detail)
		}
	}

	// Nothing half-made is left for the next attempt to trip on.
	entries, err := os.ReadDir(filepath.Dir(layout.Mirror(repo)))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 0 {
		t.Fatalf("a failed clone left %v behind", entries)
	}
}

func TestEnsureClearsAnEmptyMirrorAnOlderRunnerLeft(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	if err := os.MkdirAll(layout.Mirror(repo), 0o700); err != nil {
		t.Fatal(err)
	}

	if err := c.Ensure(context.Background(), repo, remote, ""); err != nil {
		t.Fatalf("clone over an empty directory: %v", err)
	}
}

func TestAddAdoptsTheWorktreeItAlreadyMadeForTheSameBranch(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, ""); err != nil {
		t.Fatal(err)
	}
	worktree := layout.Worktree(repo, "redelivered")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/redelivered", "main", true); err != nil {
		t.Fatal(err)
	}

	// The redelivered create: same session, so same path and same branch.
	if err := c.Add(ctx, repo, worktree, "oppenheimer/redelivered", "main", true); err != nil {
		t.Fatalf("a redelivered add must adopt its own worktree: %v", err)
	}
}

func TestAddFinishesAWorktreeWhoseAddWasKilled(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, ""); err != nil {
		t.Fatal(err)
	}
	worktree := layout.Worktree(repo, "killed")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/killed", "main", true); err != nil {
		t.Fatal(err)
	}
	// What a `git worktree add` killed half-way leaves: git's own
	// "initializing" lock, and a checkout that may not have finished.
	gitDir := strings.TrimSpace(git(t, worktree, "rev-parse", "--git-dir"))
	if err := os.WriteFile(filepath.Join(gitDir, "locked"), []byte("initializing"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(worktree, "README.md")); err != nil {
		t.Fatal(err)
	}

	if err := c.Add(ctx, repo, worktree, "oppenheimer/killed", "main", true); err != nil {
		t.Fatalf("adopt: %v", err)
	}

	if _, err := os.Stat(filepath.Join(worktree, "README.md")); err != nil {
		t.Fatal("the checkout was not completed")
	}
	if list := git(t, layout.Mirror(repo), "worktree", "list", "--porcelain"); strings.Contains(list, "locked") {
		t.Fatalf("the worktree is still locked:\n%s", list)
	}
	if dirty, err := c.Dirty(ctx, worktree); err != nil || dirty {
		t.Fatalf("the adopted worktree is not clean: dirty = %v, err = %v", dirty, err)
	}
}

func TestAddReplacesARegistrationWhoseDirectoryIsGone(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, ""); err != nil {
		t.Fatal(err)
	}
	worktree := layout.Worktree(repo, "vanished")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/vanished", "main", true); err != nil {
		t.Fatal(err)
	}
	gitDir := strings.TrimSpace(git(t, worktree, "rev-parse", "--absolute-git-dir"))
	if err := os.WriteFile(filepath.Join(gitDir, "locked"), []byte("initializing"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.RemoveAll(worktree); err != nil {
		t.Fatal(err)
	}

	if err := c.Add(ctx, repo, worktree, "oppenheimer/vanished", "main", true); err != nil {
		t.Fatalf("add over a stale registration: %v", err)
	}
	if _, err := os.Stat(filepath.Join(worktree, "README.md")); err != nil {
		t.Fatal("the worktree was not recreated")
	}
}

func TestAddReusesABranchAKilledAttemptCreatedWithoutItsWorktree(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, ""); err != nil {
		t.Fatal(err)
	}
	git(t, layout.Mirror(repo), "branch", "oppenheimer/orphan", "origin/main")

	worktree := layout.Worktree(repo, "orphan")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/orphan", "main", true); err != nil {
		t.Fatalf("add with the branch already cut: %v", err)
	}
}

func TestAddKeepsABranchThatHasWorkOfItsOwn(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, ""); err != nil {
		t.Fatal(err)
	}
	mirror := layout.Mirror(repo)
	git(t, mirror, "branch", "oppenheimer/busy", "origin/main")
	tip := strings.TrimSpace(git(t, mirror, "-c", "user.email=t@example.com", "-c", "user.name=T",
		"commit-tree", "-m", "work", "-p", "oppenheimer/busy", "oppenheimer/busy^{tree}"))
	git(t, mirror, "update-ref", "refs/heads/oppenheimer/busy", tip)

	err := c.Add(ctx, repo, layout.Worktree(repo, "busy"), "oppenheimer/busy", "main", true)

	if err == nil {
		t.Fatal("a branch with commits of its own must not be reset to the base")
	}
	if got := strings.TrimSpace(git(t, mirror, "rev-parse", "oppenheimer/busy")); got != tip {
		t.Fatalf("the branch moved: %s, want %s", got, tip)
	}
}

func TestACancelledCommandIsNotReportedAsAGitFailure(t *testing.T) {
	remote := origin(t)
	c, _ := client(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	err := c.Ensure(ctx, repo, remote, "")

	var prob *problem.Error
	if !isProblem(err, &prob, "GIT_005") {
		t.Fatalf("err = %v, want GIT_005", err)
	}
}
