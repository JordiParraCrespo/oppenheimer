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
	"sync"
	"testing"
	"time"

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
	return credentialHelper(t, dir, "helper",
		"printf '%s\\n' \"$"+gitadapter.SessionEnv+"\" >> '"+seen+"'\n"+
			"[ \"$"+gitadapter.SessionEnv+"\" = '"+sessionID+"' ] || exit 0\n"+
			"printf 'username="+privateUser+"\\npassword="+privateToken+"\\n'\n"), seen
}

// credentialHelper writes a git credential helper whose `get` runs body after
// reading git's request; every other action is a no-op.
func credentialHelper(t *testing.T, dir, name, body string) string {
	t.Helper()
	return executable(t, dir, name, "[ \"$1\" = get ] || exit 0\ncat >/dev/null\n"+body)
}

// executable writes a shell script into dir, the one way every stand-in
// program here (helpers, askpass, git) is made.
func executable(t *testing.T, dir, name, body string) string {
	t.Helper()
	script := filepath.Join(dir, name)
	if err := os.WriteFile(script, []byte("#!/bin/sh\n"+body), 0o700); err != nil { //nolint:gosec // a stand-in program must be executable
		t.Fatal(err)
	}
	return script
}

func privateClient(t *testing.T) (*gitadapter.Client, domain.Layout, string) {
	t.Helper()
	command, seen := helper(t)
	layout := domain.Layout{Root: t.TempDir()}
	c := gitadapter.New(gitadapter.Options{Layout: layout, CredentialHelper: command})
	t.Cleanup(c.Wait)
	return c, layout, seen
}

func TestEnsureClonesAPrivateRepositoryForTheSessionItIsFor(t *testing.T) {
	remote := privateOrigin(t)
	c, layout, seen := privateClient(t)
	ctx := context.Background()

	if err := c.Ensure(domain.WithSession(ctx, sessionID), repo, remote, "main"); err != nil {
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
	if err := c.Ensure(domain.WithSession(ctx, sessionID), repo, "", "main"); err != nil {
		t.Fatalf("fetch of a private repository for a session: %v", err)
	}

	// And so does the push when the session closes.
	worktree := layout.Worktree(repo, "session-private")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/private", "main", true); err != nil {
		t.Fatal(err)
	}
	git(t, worktree, "-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "--allow-empty", "-m", "work")
	if pushed, err := c.Push(domain.WithSession(ctx, sessionID), worktree, "oppenheimer/private"); err != nil || !pushed {
		t.Fatalf("push = %v, err = %v", pushed, err)
	}
}

func TestPushForNoSessionIsRefusedBeforeTheNetwork(t *testing.T) {
	remote := privateOrigin(t)
	c, layout, seen := privateClient(t)
	ctx := context.Background()
	if err := c.Ensure(domain.WithSession(ctx, sessionID), repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	worktree := layout.Worktree(repo, "session-unmarked")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/unmarked", "main", true); err != nil {
		t.Fatal(err)
	}
	before, _ := os.ReadFile(seen)

	_, err := c.Push(ctx, worktree, "oppenheimer/unmarked")

	var prob *problem.Error
	if !isProblem(err, &prob, "GIT_004") {
		t.Fatalf("err = %v, want GIT_004", err)
	}
	if after, _ := os.ReadFile(seen); string(after) != string(before) {
		t.Fatalf("the helper was asked (%q): the push reached the network", after)
	}
}

func TestEnsureSaysWhatIsMissingWhenAPrivateCloneHasNoCredential(t *testing.T) {
	remote := privateOrigin(t)
	c, layout, _ := privateClient(t)

	for _, session := range []string{"", "a-session-the-control-plane-refuses"} {
		err := c.Ensure(domain.WithSession(context.Background(), session), repo, remote, "main")

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

// A remote that wants a credential the helper does not have must fail the
// clone, not ask anyone: a daemon has no one to ask, and a prompt it waits on
// hangs the session create. The askpass programs the daemon's environment
// names are what git would run to ask; each one here writes a marker.
func TestGitNeverAsksForAPassword(t *testing.T) {
	remote := privateOrigin(t)
	c, _, _ := privateClient(t)
	marker := filepath.Join(t.TempDir(), "asked")
	askpass := executable(t, t.TempDir(), "askpass", "echo asked >> '"+marker+"'\n")
	t.Setenv("GIT_ASKPASS", askpass)
	t.Setenv("SSH_ASKPASS", askpass)
	t.Setenv("GIT_TERMINAL_PROMPT", "1")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := c.Ensure(ctx, repo, remote, "main")

	var prob *problem.Error
	if !isProblem(err, &prob, "GIT_004") || ctx.Err() != nil {
		t.Fatalf("err = %v, ctx = %v; want GIT_004 at once", err, ctx.Err())
	}
	if _, err := os.Stat(marker); err == nil {
		t.Fatal("git ran an askpass program to ask for a password")
	}
}

// The classifier: each sign in the table needsCredential reads turns a git
// that printed it into GIT_004, whose detail does not relay a prompt nobody
// was shown, and a failure that is not about a credential stays a plain git
// error. A stand-in git prints each line; what a real git prints is held by
// the private-origin tests above, on whichever git runs them.
func TestCredentialSignsClassifyAsGIT004(t *testing.T) {
	cases := map[string]struct {
		out  string
		want bool
	}{
		"not a credential: DNS": {
			out: "fatal: unable to access 'https://github.com/jordi/oppenheimer.git/': Could not resolve host: github.com",
		},
	}
	for _, s := range gitadapter.CredentialSigns {
		cases[s.Git] = struct {
			out  string
			want bool
		}{out: "fatal: " + s.Sign, want: true}
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			c := gitadapter.New(gitadapter.Options{
				Layout:           domain.Layout{Root: t.TempDir()},
				Binary:           executable(t, t.TempDir(), "git", "cat >&2 <<'EOF'\n"+tc.out+"\nEOF\nexit 128\n"),
				CredentialHelper: "runner credential-helper",
			})
			t.Cleanup(c.Wait)

			err := c.Ensure(domain.WithSession(context.Background(), sessionID), repo, "https://github.com/jordi/oppenheimer.git", "main")

			var prob *problem.Error
			if err == nil || isProblem(err, &prob, "GIT_004") != tc.want {
				t.Fatalf("err = %v, want GIT_004: %v", err, tc.want)
			}
			if tc.want && strings.Contains(prob.Detail, tc.out[len("fatal: "):]) {
				t.Fatalf("the detail relays git's prompt, which nobody was shown: %s", prob.Detail)
			}
		})
	}
}

// A helper the host's system gitconfig names (osxkeychain on a Mac) is never
// asked for a session's token: it would answer with whatever the account
// stored, for any session, and the control plane would never have said yes.
// Here that helper even has the right token; the clone must still fail for a
// session the runner's helper refuses.
func TestOnlyTheRunnersHelperIsAsked(t *testing.T) {
	remote := privateOrigin(t)
	c, _, _ := privateClient(t)
	dir := t.TempDir()
	marker := filepath.Join(dir, "asked")
	keychain := credentialHelper(t, dir, "keychain",
		"echo asked >> '"+marker+"'\n"+
			"printf 'username="+privateUser+"\\npassword="+privateToken+"\\n'\n")
	system := filepath.Join(dir, "gitconfig")
	if err := os.WriteFile(system, []byte("[credential]\n\thelper = "+keychain+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("GIT_CONFIG_SYSTEM", system)
	t.Setenv("GIT_CONFIG_NOSYSTEM", "0")

	err := c.Ensure(domain.WithSession(context.Background(), "a-session-the-control-plane-refuses"), repo, remote, "main")

	var prob *problem.Error
	if !isProblem(err, &prob, "GIT_004") {
		t.Fatalf("err = %v, want GIT_004", err)
	}
	if _, err := os.Stat(marker); err == nil {
		t.Fatal("git asked the system gitconfig's credential helper")
	}
	// The stand-in is a working keychain: any other git on the host gets in.
	git(t, "", "ls-remote", remote)
	if _, err := os.Stat(marker); err != nil {
		t.Fatal("the system helper was never asked by a plain git either; the test proves nothing")
	}
}

func TestEnsureClearsAnEmptyMirrorAnOlderRunnerLeft(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	if err := os.MkdirAll(layout.Mirror(repo), 0o700); err != nil {
		t.Fatal(err)
	}

	if err := c.Ensure(context.Background(), repo, remote, "main"); err != nil {
		t.Fatalf("clone over an empty directory: %v", err)
	}
}

func TestAddAdoptsTheWorktreeItAlreadyMadeForTheSameBranch(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
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
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
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
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
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
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
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
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
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

// The #79 case: git is killed part-way through because the runner stopped
// waiting, after it had already printed something. That output is not the
// reason — in #79 it was git announcing its own success — so it is not quoted.
func TestACommandStoppedPartWayIsAbandonedNotAGitFailure(t *testing.T) {
	c, _ := client(t)
	asked := make(chan struct{})
	var once sync.Once
	// A remote that accepts the connection, then never answers: git has
	// started, and printed "Cloning into …", when the context ends.
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		once.Do(func() { close(asked) })
		<-r.Context().Done()
	}))
	defer server.Close()
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		<-asked
		time.Sleep(100 * time.Millisecond)
		cancel()
	}()

	err := c.Ensure(ctx, repo, server.URL+"/slow.git", "main")

	var prob *problem.Error
	if !isProblem(err, &prob, "GIT_005") {
		t.Fatalf("err = %v, want GIT_005", err)
	}
	if strings.Contains(prob.Detail, "Cloning into") {
		t.Fatalf("the detail quotes what git printed before it was stopped: %s", prob.Detail)
	}
}
