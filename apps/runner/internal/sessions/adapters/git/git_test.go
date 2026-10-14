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

// TestMain keeps the developer's ~/.gitconfig out of every git this package
// starts, the adapter's and the fixtures' alike: a commit.gpgsign, a
// core.hooksPath or a url.insteadOf there would otherwise decide whether a
// test passes. The system gitconfig stays in play, as it is on a host; what
// keeps its credential helper out is the adapter's own reset, which
// TestOnlyTheRunnersHelperIsAsked holds.
func TestMain(m *testing.M) {
	os.Exit(hermetic(m))
}

func hermetic(m *testing.M) int {
	empty, err := os.CreateTemp("", "gitconfig-")
	if err != nil {
		panic(err)
	}
	_ = empty.Close()
	defer os.Remove(empty.Name())
	if err := os.Setenv("GIT_CONFIG_GLOBAL", empty.Name()); err != nil {
		panic(err)
	}
	return m.Run()
}

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

// git runs a git command in dir and fails the test if it does not work.
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
	c := gitadapter.New(gitadapter.Options{Layout: layout})
	t.Cleanup(c.Wait)
	return c, layout
}

// tenant is the account and workspace the tests' stores and sessions sit
// under.
var tenant = domain.Tenant{Account: "acct", Workspace: "ws"}

var repo = domain.Repository{Tenant: tenant, FullName: "jordi/oppenheimer", GithubID: 42}

// checkout is where a session's checkout of repo goes: its folder in the
// workspace's sessions, named after the repository.
func checkout(layout domain.Layout, slug string) string {
	return filepath.Join(layout.Session(tenant, slug), "oppenheimer")
}

// advance lands a commit on branch in the origin, from a scratch clone.
func advance(t *testing.T, remote, branch string) {
	t.Helper()
	work := filepath.Join(t.TempDir(), "advance")
	git(t, "", "clone", "-q", remote, work)
	git(t, work, "-c", "user.email=test@example.com", "-c", "user.name=Test",
		"commit", "--allow-empty", "-q", "-m", "upstream moved")
	git(t, work, "push", "-q", "origin", "HEAD:refs/heads/"+branch)
}

func remoteRef(t *testing.T, mirror, ref string) string {
	t.Helper()
	cmd := exec.Command("git", "rev-parse", "--verify", "--quiet", "refs/remotes/origin/"+ref)
	cmd.Dir = mirror
	out, _ := cmd.Output()
	return strings.TrimSpace(string(out))
}

// A first clone is shallow, so a worktree can be cut before the history
// arrives, and then becomes the blobless store with the whole history that a
// session's `git log` reads; nothing is checked out in the mirror itself.
func TestEnsureClonesShallowThenDeepensToABloblessStore(t *testing.T) {
	bare := origin(t)
	advance(t, bare, "main")
	advance(t, bare, "next")
	// A local path clones by copying the object store, depth and filter or
	// not; the file transport is how git behaves against a server.
	git(t, bare, "config", "uploadpack.allowFilter", "true")
	c, layout := client(t)
	ctx := context.Background()

	if err := c.Ensure(ctx, repo, "file://"+bare, "main"); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	mirror := layout.Store(repo)
	if _, err := os.Stat(filepath.Join(mirror, "README.md")); !os.IsNotExist(err) {
		t.Fatalf("the mirror has a working tree: %v", err)
	}
	// A worktree can be cut at once, deepened or not.
	worktree := checkout(layout, "shallow")
	if err := c.Add(ctx, repo, worktree, "oppenheimer/shallow", "main", true); err != nil {
		t.Fatalf("add: %v", err)
	}
	if _, err := os.Stat(filepath.Join(worktree, "README.md")); err != nil {
		t.Fatalf("the worktree has no files: %v", err)
	}

	deadline := time.Now().Add(30 * time.Second)
	for {
		_, err := os.Stat(filepath.Join(mirror, "shallow"))
		if os.IsNotExist(err) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the mirror was never deepened")
		}
		time.Sleep(20 * time.Millisecond)
	}
	if got := strings.TrimSpace(git(t, mirror, "config", "remote.origin.partialclonefilter")); got != "blob:none" {
		t.Fatalf("partialclonefilter = %q, want blob:none", got)
	}
	if got := strings.TrimSpace(git(t, mirror, "rev-list", "--count", "refs/remotes/origin/main")); got != "2" {
		t.Fatalf("origin/main has %s commits, want the whole history (2)", got)
	}
	if remoteRef(t, mirror, "next") == "" {
		t.Fatal("the deepen did not fetch every branch")
	}
}

// A store is bare, so nobody's `git status` in it sees a checkout (24 §2), and
// it records the GitHub id of the repository it caches: a repository renamed
// on GitHub keeps its store, and its history, instead of being downloaded
// again under the new name. Each workspace has stores of its own.
func TestAStoreIsBareAndARenamedRepositoryKeepsIt(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	store := layout.Store(repo)
	if got := strings.TrimSpace(git(t, store, "rev-parse", "--is-bare-repository")); got != "true" {
		t.Fatalf("the store at %s is not bare", store)
	}
	if got := strings.TrimSpace(git(t, store, "config", "oppenheimer.repo-id")); got != "42" {
		t.Fatalf("oppenheimer.repo-id = %q, want 42", got)
	}

	renamed := domain.Repository{Tenant: tenant, FullName: "jordi/renamed", GithubID: 42}
	if !c.Has(renamed) {
		t.Fatal("the renamed repository's store was not found by its id")
	}
	path := checkout(layout, "renamed")
	if err := c.Add(ctx, renamed, path, "oppenheimer/renamed", "main", true); err != nil {
		t.Fatalf("add on the renamed repository: %v", err)
	}
	if _, err := os.Stat(filepath.Join(path, "README.md")); err != nil {
		t.Fatalf("the checkout has no files: %v", err)
	}
	if _, err := os.Stat(layout.Store(renamed)); !os.IsNotExist(err) {
		t.Fatalf("a second store was made for the renamed repository: %v", err)
	}

	other := domain.Repository{Tenant: domain.Tenant{Account: "acct", Workspace: "other"}, FullName: repo.FullName, GithubID: 42}
	if c.Has(other) {
		t.Fatal("one workspace's store counted for another's")
	}
}

// A repository renamed away leaves its store under the old name; another
// repository that later takes that name gets a store of its own, never the
// first one's, and the first still finds its store by id.
func TestAStoreUnderAReusedNameIsNotTakenByTheNewRepository(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	first := layout.Store(repo)

	// Repository 42 was renamed; repository 7 took its old full name.
	taker := domain.Repository{Tenant: tenant, FullName: repo.FullName, GithubID: 7}
	if c.Has(taker) {
		t.Fatal("the new repository counted the old one's store as its own")
	}
	if err := c.Ensure(ctx, taker, remote, "main"); err != nil {
		t.Fatal(err)
	}
	second := strings.TrimSuffix(first, ".git") + "-7.git"
	if got := strings.TrimSpace(git(t, second, "config", "oppenheimer.repo-id")); got != "7" {
		t.Fatalf("the new repository's store at %s records id %q, want 7", second, got)
	}
	if got := strings.TrimSpace(git(t, first, "config", "oppenheimer.repo-id")); got != "42" {
		t.Fatalf("the old store now records id %q, want 42", got)
	}
	if !c.Has(taker) {
		t.Fatal("the new repository's own store is not found again")
	}

	renamed := domain.Repository{Tenant: tenant, FullName: "jordi/renamed", GithubID: 42}
	path := checkout(layout, "renamed")
	if err := c.Add(ctx, renamed, path, "oppenheimer/renamed", "main", true); err != nil {
		t.Fatalf("add on the renamed repository: %v", err)
	}
}

// A store reused after a rename fetches from the remote the caller names now,
// not the one it was made with.
func TestAReusedStoreFetchesFromTheRemoteItIsGiven(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	moved := filepath.Join(t.TempDir(), "renamed.git")
	if err := os.Rename(remote, moved); err != nil {
		t.Fatal(err)
	}

	renamed := domain.Repository{Tenant: tenant, FullName: "jordi/renamed", GithubID: 42}
	if err := c.Ensure(ctx, renamed, moved, "main"); err != nil {
		t.Fatalf("a fetch from the remote the store was not made with: %v", err)
	}
	store := layout.Store(repo)
	if got := strings.TrimSpace(git(t, store, "remote", "get-url", "origin")); got != moved {
		t.Fatalf("origin = %q, want %q", got, moved)
	}
}

// A deepen fetches into a new store in the background and holds its config
// lock while it does; a second session on the same repository, started then,
// names the remote the store already has and must not fail on rewriting it.
func TestASecondEnsureDoesNotRewriteAnUnchangedRemote(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	c.Wait()
	lock := filepath.Join(layout.Store(repo), "config.lock")
	if err := os.WriteFile(lock, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(lock)
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatalf("a second ensure while the config is locked: %v", err)
	}
}

// Has is what tells a first session's download from a later one's fetch, and
// a clone that failed half-way must not count as the repository being here.
func TestHasIsTrueOnlyOnceAWholeCloneIsInPlace(t *testing.T) {
	remote := origin(t)
	c, _ := client(t)
	ctx := context.Background()
	if c.Has(repo) {
		t.Fatal("a repository never cloned is reported as here")
	}
	if err := c.Ensure(ctx, repo, remote, "no-such-branch"); err == nil {
		t.Fatal("a clone of a missing branch succeeded")
	}
	if c.Has(repo) {
		t.Fatal("a failed clone is reported as the repository being here")
	}
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	if !c.Has(repo) {
		t.Fatal("a cloned repository is not reported as here")
	}
}

func TestEnsureFetchesOnlyTheBranchesItIsGiven(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	mirror := layout.Store(repo)
	before := remoteRef(t, mirror, "main")
	advance(t, remote, "main")
	advance(t, remote, "elsewhere")

	if err := c.Ensure(ctx, repo, "", "main"); err != nil {
		t.Fatalf("ensure: %v", err)
	}

	if remoteRef(t, mirror, "main") == before {
		t.Fatal("origin/main did not move")
	}
	if remoteRef(t, mirror, "elsewhere") != "" {
		t.Fatal("a branch nobody asked for was fetched")
	}
}

func TestEnsureFailsWhenTheRefIsNotABranchOnTheRemote(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	advance(t, remote, "elsewhere")

	err := c.Ensure(ctx, repo, "", "no-such-branch")

	var prob *problem.Error
	if !isProblem(err, &prob, domain.ErrGitCommand.Code) {
		t.Fatalf("err = %v, want %s", err, domain.ErrGitCommand.Code)
	}
	// One fetch, not a second one of everything.
	if remoteRef(t, layout.Store(repo), "elsewhere") != "" {
		t.Fatal("a failed fetch went on to fetch every branch")
	}
}

func TestEnsureRefusesARepositoryItHasNeverSeenWithNoRemote(t *testing.T) {
	c, _ := client(t)

	err := c.Ensure(context.Background(), repo, "", "main")

	var prob *problem.Error
	if !isProblem(err, &prob, "GIT_001") {
		t.Fatalf("err = %v, want GIT_001", err)
	}
}

func TestEnsureRefusesARepositoryNameThatWouldEscapeTheLayout(t *testing.T) {
	c, _ := client(t)

	for _, name := range []string{"../../etc", "owner/../../etc", "not-a-repo"} {
		bad := domain.Repository{Tenant: tenant, FullName: name}
		if err := c.Ensure(context.Background(), bad, "https://example.test/x.git", "main"); err == nil {
			t.Fatalf("%q must not be accepted as a repository name", name)
		}
	}
	for _, bad := range []domain.Tenant{{Account: "..", Workspace: "ws"}, {Account: "acct", Workspace: "../x"}, {}} {
		if err := c.Ensure(context.Background(), domain.Repository{Tenant: bad, FullName: repo.FullName}, "https://example.test/x.git", "main"); err == nil {
			t.Fatalf("%+v must not be accepted as a workspace", bad)
		}
	}
}

func TestAddCutsANewBranchFromTheBaseAndRemoveTakesItAway(t *testing.T) {
	remote := origin(t)
	c, layout := client(t)
	ctx := context.Background()
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	worktree := checkout(layout, "session-abc")

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
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	worktree := checkout(layout, "taken")
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
	if err := c.Ensure(ctx, repo, remote, "main"); err != nil {
		t.Fatal(err)
	}
	worktree := checkout(layout, "session-push")
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
