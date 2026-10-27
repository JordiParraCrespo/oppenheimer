// Package git keeps the work folder's stores and the worktrees cut from them
// (24 §2): one bare store per repository and workspace, one worktree per
// session, in the session's own folder.
//
//	<work folder>/<account>/<workspace>/repos/<owner>--<repo>.git        the bare store, never edited
//	<work folder>/<account>/<workspace>/repos/.spares/<owner>--<repo>    the next create's worktree
//	<work folder>/<account>/<workspace>/sessions/<slug>/<directory>      one per session
//
// A store records the GitHub id of the repository it caches
// (`oppenheimer.repo-id`), so a repository renamed on GitHub is found under
// the name its store was made with.
//
// Credentials never reach this package: git asks the runner's credential
// helper over the local socket when it needs one, so nothing is written to
// disk and nothing is passed on a command line. What this package does pass
// is the session a fetch or push is for, in the helper's environment, since
// that is how the helper says whose token it wants; it rides the context
// (domain.WithSession), so no port carries an adapter's environment.
package git

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
	"github.com/jordiparracrespo/oppenheimer/packages/go/execx"
)

var _ app.Worktrees = (*Client)(nil)

// Timeouts: a clone of a large repository is slow, a status is not.
const (
	fetchTimeout = 10 * time.Minute
	quickTimeout = 60 * time.Second
	// removeTimeout bounds `worktree remove`, which deletes every file in the
	// checkout: tens of thousands with node_modules, well past a minute on a
	// slow disk. Killed partway, it leaves the session's delete refused.
	removeTimeout = 10 * time.Minute
	// waitDelay bounds how long a killed git's output is waited on.
	waitDelay = 5 * time.Second
)

// SessionEnv is the variable the credential helper reads to say which
// session it is asking for. A tmux session carries it in its environment; a
// git command this package runs on a session's behalf carries it here.
const SessionEnv = "OPPENHEIMER_SESSION"

// partialPrefix names a store being made, beside the store it will become.
// A first fetch lands under this name and is renamed into place only once it
// is whole, so a download cut short never leaves a store that looks usable.
const partialPrefix = ".partial-"

// repoIDKey is the store's config entry naming the GitHub repository it
// caches, by id.
const repoIDKey = "oppenheimer.repo-id"

// Client runs git.
type Client struct {
	layout domain.Layout
	binary string
	// credentialHelper, when set, is the command git calls for a password.
	// It is the runner's own `credential-helper` subcommand.
	credentialHelper string

	// stores serialises the work on one store, keyed by its path. Creates run
	// side by side, and two sessions on a repository this host has never
	// seen would otherwise both download it, or cut worktrees while the
	// other is fetching.
	mu     sync.Mutex
	stores map[string]*sync.Mutex

	// prewarm keeps a spare worktree per store (spares.go), held in spares
	// under mu and keyed by the store's path; warming counts the ones being
	// made.
	prewarm bool
	spares  map[string]*spare
	warming sync.WaitGroup

	// deepening holds, under mu, the stores fetched shallow whose history is
	// still being fetched (deepen), by path; the channel closes when it lands.
	deepening map[string]chan struct{}
}

// Options configure the client.
type Options struct {
	Layout           domain.Layout
	Binary           string
	CredentialHelper string
	// Spares keeps one worktree per store checked out ahead of the next
	// create.
	Spares bool
}

// New builds the client.
func New(opts Options) *Client {
	binary := opts.Binary
	if binary == "" {
		binary = "git"
	}
	return &Client{
		layout: opts.Layout, binary: binary, credentialHelper: opts.CredentialHelper,
		stores: map[string]*sync.Mutex{}, prewarm: opts.Spares, spares: map[string]*spare{},
		deepening: map[string]chan struct{}{},
	}
}

func (c *Client) lock(store string) func() {
	c.mu.Lock()
	m, ok := c.stores[store]
	if !ok {
		m = &sync.Mutex{}
		c.stores[store] = m
	}
	c.mu.Unlock()
	m.Lock()
	return m.Unlock
}

// storeOf finds a repository's store. Under its own name first, when that
// store records this repository's GitHub id (or records none, as a store the
// CLI made does not); else, among the workspace's stores, the one that records
// the id — a repository renamed on GitHub keeps the store it already has.
// Neither found, it is the path a new store is made at: the repository's own
// name, or, when another repository's store already holds that name (it was
// renamed away and this one took its old name), the name with the id after it.
func (c *Client) storeOf(repo domain.Repository) string {
	named := c.layout.Store(repo)
	if repo.GithubID == 0 {
		return named
	}
	want := strconv.FormatInt(repo.GithubID, 10)
	if whole(named) {
		if id := c.repoIDOf(named); id == "" || id == want {
			return named
		}
	}
	repos := c.layout.Repos(repo.Tenant)
	if entries, err := os.ReadDir(repos); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() || !strings.HasSuffix(entry.Name(), ".git") || strings.HasPrefix(entry.Name(), ".") {
				continue
			}
			store := filepath.Join(repos, entry.Name())
			if store != named && c.repoIDOf(store) == want {
				return store
			}
		}
	}
	if !whole(named) {
		return named
	}
	return strings.TrimSuffix(named, ".git") + "-" + want + ".git"
}

// repoIDOf is the GitHub id a store records, empty when it records none.
func (c *Client) repoIDOf(store string) string {
	out, err := c.run(context.Background(), command{timeout: quickTimeout},
		"config", "--file", filepath.Join(store, "config"), "--get", repoIDKey)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(out)
}

// originOf is the URL a store fetches from, empty when it records none.
func (c *Client) originOf(store string) string {
	out, err := c.run(context.Background(), command{timeout: quickTimeout},
		"config", "--file", filepath.Join(store, "config"), "--get", "remote.origin.url")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(out)
}

// whole reports a store that is all there. A store is made beside its place
// and renamed into it once its first fetch has landed, so a store with a
// HEAD is never half a download.
func whole(store string) bool {
	_, err := os.Stat(filepath.Join(store, "HEAD"))
	return err == nil
}

// Has implements app.Worktrees.
func (c *Client) Has(repo domain.Repository) bool {
	if repo.Validate() != nil {
		return false
	}
	return whole(c.storeOf(repo))
}

// Ensure makes sure the repository's store exists and that ref is fresh in
// it; an empty ref fetches every branch. The first call makes the store;
// later ones fetch. The store is bare and blobless (02-runner §5, 24 §2): a
// file's contents arrive when a checkout or a command first reads them,
// through the same credential helper. A first fetch is shallow at ref and the
// history follows in the background (deepen).
func (c *Client) Ensure(ctx context.Context, repo domain.Repository, remote, ref string) error {
	if err := repo.Validate(); err != nil {
		return domain.ErrWorktree.WithDetail("%v", err).WithCause(err)
	}
	if ref != "" {
		if err := domain.ValidateBranch(ref); err != nil {
			return domain.ErrWorktree.WithDetail("%v", err).WithCause(err)
		}
	}
	store := c.storeOf(repo)
	defer c.lock(store)()
	if whole(store) {
		// The store may have been made under the repository's old name, or
		// from another remote: what is fetched is what the caller names now.
		// Written only when it differs: a deepen may be fetching into this
		// store in the background, holding its config lock, and a second
		// session on the same repository must not fail on a no-op write.
		if remote != "" && c.originOf(store) != remote {
			// A deepen holds the config lock for as long as it fetches, so a
			// write that has to happen waits for it to land.
			if err := c.awaitDeepen(ctx, store); err != nil {
				return err
			}
			if _, err := c.run(ctx, command{timeout: quickTimeout, dir: store}, "remote", "set-url", "origin", remote); err != nil {
				return err
			}
		}
		if c.deepeningOf(store) != nil {
			// A deepen is fetching every branch right now, from a clone made
			// moments ago: a ref the clone brought is current, and a second
			// fetch beside the deepen would contend for the same refs.
			if ref == "" || c.hasRemoteBranch(ctx, store, ref) {
				return nil
			}
			if err := c.awaitDeepen(ctx, store); err != nil {
				return err
			}
		}
		if err := c.fetch(ctx, repo.FullName, store, ref); err != nil {
			return err
		}
		// A shallow store whose deepen was cut short (a runner restart)
		// gets its history now.
		c.deepen(ctx, repo.FullName, store)
		return nil
	}
	if remote == "" {
		return domain.ErrWorktree.WithDetail(
			"%s has never been fetched on this host and no remote was given", repo.FullName)
	}
	parent := filepath.Dir(store)
	if err := os.MkdirAll(parent, 0o700); err != nil {
		return domain.ErrWorktree.WithDetail("create %s: %v", parent, err).WithCause(err)
	}
	// A store directory with no HEAD is not one this runner finished. Empty,
	// it is nothing and goes; with anything in it, it is not ours to delete.
	if err := os.Remove(store); err != nil && !os.IsNotExist(err) {
		return domain.ErrWorktree.WithDetail(
			"%s exists but is not a store of %s; move it aside and start the session again", store, repo.FullName)
	}
	sweepPartials(parent)

	partial, err := os.MkdirTemp(parent, partialPrefix)
	if err != nil {
		return domain.ErrWorktree.WithDetail("create a directory to fetch into: %v", err).WithCause(err)
	}
	if err := c.makeStore(ctx, repo, remote, ref, partial); err != nil {
		_ = os.RemoveAll(partial)
		return err
	}
	if err := os.Rename(partial, store); err != nil {
		_ = os.RemoveAll(partial)
		return domain.ErrWorktree.WithDetail("move the store into %s: %v", store, err).WithCause(err)
	}
	c.deepen(ctx, repo.FullName, store)
	return nil
}

// makeStore makes a bare store at dir and fetches ref into it. Bare, so that
// nobody's `git status` in it sees a checkout and no editor walks into one
// (24 §2); its branches are origin's, as a clone's would be, under
// refs/remotes/origin.
//
// Shallow first: the base's one commit with its files is what a worktree
// needs, and on a large repository it is a third of the time a blobless clone
// of the whole history takes (14). The history follows in the background
// (deepen), leaving the store blobless as it always was.
func (c *Client) makeStore(ctx context.Context, repo domain.Repository, remote, ref, dir string) error {
	quick := command{timeout: quickTimeout, dir: dir}
	if _, err := c.run(ctx, command{timeout: quickTimeout}, "init", "--bare", "--quiet", dir); err != nil {
		return err
	}
	// `remote add` writes the refspec every branch is fetched by, which is
	// what a bare `git fetch` in the session's shell uses afterwards.
	if _, err := c.run(ctx, quick, "remote", "add", "origin", remote); err != nil {
		return err
	}
	if repo.GithubID != 0 {
		if _, err := c.run(ctx, quick, "config", repoIDKey, strconv.FormatInt(repo.GithubID, 10)); err != nil {
			return err
		}
	}
	args := append(append([]string{}, noMaintenance...), "fetch", "--depth=1", "--no-tags", "origin")
	if ref != "" {
		args = append(args, "+refs/heads/"+ref+":refs/remotes/origin/"+ref)
	}
	_, err := c.run(ctx, command{timeout: fetchTimeout, dir: dir, repo: repo.FullName}, args...)
	return err
}

// deepen fetches, in the background, the history a shallow store was made
// without: every branch's commits and trees, the blobs left to arrive when
// read, as a blobless clone would have had them. It takes no lock, so creates
// go on beside it; Ensure leaves the fetching to it while it runs. ctx's
// session rides along for the token; its end does not.
func (c *Client) deepen(ctx context.Context, repo, store string) {
	if _, err := os.Stat(filepath.Join(store, "shallow")); err != nil {
		return
	}
	c.mu.Lock()
	if _, running := c.deepening[store]; running {
		c.mu.Unlock()
		return
	}
	landed := make(chan struct{})
	c.deepening[store] = landed
	c.mu.Unlock()

	c.warming.Add(1)
	go func() {
		defer c.warming.Done()
		defer func() {
			c.mu.Lock()
			delete(c.deepening, store)
			c.mu.Unlock()
			close(landed)
		}()
		ctx := context.WithoutCancel(ctx)
		quick := command{timeout: quickTimeout, dir: store}
		// Promised objects are what a blobless clone records: the blobs of
		// older commits stay on the remote until something reads them.
		if _, err := c.run(ctx, quick, "config", "remote.origin.promisor", "true"); err != nil {
			return
		}
		if _, err := c.run(ctx, quick, "config", "remote.origin.partialclonefilter", "blob:none"); err != nil {
			return
		}
		args := append(append([]string{}, noMaintenance...), "fetch", "--unshallow", "--filter=blob:none", "origin")
		_, _ = c.run(ctx, command{timeout: fetchTimeout, dir: store, repo: repo}, args...)
	}()
}

// deepeningOf is the channel a running deepen of store closes, or nil.
func (c *Client) deepeningOf(store string) chan struct{} {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.deepening[store]
}

// awaitDeepen waits for a running deepen of store to land, and returns at
// once when none is running. The deepen never takes the store lock, so a
// caller holding it may wait; it returns ctx's error if ctx ends first.
func (c *Client) awaitDeepen(ctx context.Context, store string) error {
	landed := c.deepeningOf(store)
	if landed == nil {
		return nil
	}
	select {
	case <-landed:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// hasRemoteBranch reports origin/<branch> in store.
func (c *Client) hasRemoteBranch(ctx context.Context, store, branch string) bool {
	_, err := c.run(ctx, command{timeout: quickTimeout, dir: store},
		"rev-parse", "--verify", "--quiet", "refs/remotes/origin/"+branch)
	return err == nil
}

// PrepareRepository gets repo ready for a create that has not been asked for
// yet: its store made or base fetched, and a spare worktree at base made and
// checked out. It returns once those are done and a first clone's history
// has landed, so the caller's context (the token its git rides on) is live for
// all of it; a create takes the spare as soon as it is ready. A spare already
// there, or being made, is kept.
func (c *Client) PrepareRepository(ctx context.Context, repo domain.Repository, remote, base string) error {
	if err := c.Ensure(ctx, repo, remote, base); err != nil {
		return err
	}
	store := c.storeOf(repo)
	if s := c.warm(ctx, store, base); s != nil {
		select {
		case <-s.done:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	// The history a shallow clone left out is fetched under this context's
	// identity too: the caller's token must outlive it. A create meanwhile
	// takes the spare and goes on without it.
	return c.awaitDeepen(ctx, store)
}

// noMaintenance keeps git from packing or gc-ing the store on the back of a
// session's clone or fetch: that work is git's to do some other time, not while a
// person waits for a terminal.
var noMaintenance = []string{"-c", "maintenance.auto=false", "-c", "gc.auto=0"}

// fetch is the one fetch a create waits on: the ref its worktree is made from,
// or every branch when it names none.
func (c *Client) fetch(ctx context.Context, repo, store, ref string) error {
	args := append(append([]string{}, noMaintenance...), "fetch", "--no-tags", "origin")
	if ref == "" {
		args = append(args, "--prune")
	} else {
		args = append(args, "+refs/heads/"+ref+":refs/remotes/origin/"+ref)
	}
	_, err := c.run(ctx, command{timeout: fetchTimeout, dir: store, repo: repo}, args...)
	return err
}

// sweepPartials removes stores in the making that nothing is still writing:
// ones older than the longest a fetch may take, left by a runner that was
// killed half-way. A younger one may belong to another process fetching the
// same repository, and is left alone.
func sweepPartials(parent string) {
	entries, err := os.ReadDir(parent)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() || !strings.HasPrefix(entry.Name(), partialPrefix) {
			continue
		}
		info, err := entry.Info()
		if err != nil || time.Since(info.ModTime()) < 2*fetchTimeout {
			continue
		}
		_ = os.RemoveAll(filepath.Join(parent, entry.Name()))
	}
}

// Add creates a worktree. A new branch is cut from the base branch as the
// store last saw it; an existing branch is checked out as it is.
//
// A path is derived from its session's id, so what is already there is that
// session's own, left by an attempt cut short, and a redelivered create takes
// it over rather than refusing it (recovery.go).
func (c *Client) Add(ctx context.Context, repo domain.Repository, path, branch, base string, newBranch bool) error {
	if err := repo.Validate(); err != nil {
		return domain.ErrWorktree.WithDetail("%v", err).WithCause(err)
	}
	store := c.storeOf(repo)
	if newBranch {
		c.awaitSpare(ctx, store)
	}
	defer c.lock(store)()
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return domain.ErrWorktree.WithDetail("create %s: %v", filepath.Dir(path), err).WithCause(err)
	}
	found, err := c.inspect(ctx, store, path, branch)
	if err != nil {
		return err
	}
	switch found.kind {
	case refuse:
		return domain.ErrSessionExists.WithDetail("%s", found.reason)
	case adopt:
		return c.adopt(ctx, store, path, found)
	case claimed:
		if !newBranch {
			return domain.ErrSessionExists.WithDetail("%s already exists, on a detached HEAD", path)
		}
		if err := c.checkoutSession(ctx, store, path, branch, base); err != nil {
			return err
		}
		c.warm(ctx, store, base)
		return nil
	case recreate:
		if err := c.clear(ctx, store, path, found); err != nil {
			return err
		}
	case vacant:
	}
	if newBranch && c.claim(ctx, store, path, branch, base) {
		c.warm(ctx, store, base)
		return nil
	}

	args := []string{"worktree", "add"}
	switch {
	case !newBranch:
		args = append(args, path, branch)
	// --no-track: a session's branch is pushed to a branch of its own
	// (push --set-upstream), never pulled from its base, and git's guess at
	// tracking the base fails outright when two refspecs map onto it.
	case c.leftoverBranch(ctx, store, branch, startPoint(base)):
		args = append(args, "--no-track", "-B", branch, path, startPoint(base))
	default:
		args = append(args, "--no-track", "-b", branch, path, startPoint(base))
	}
	if _, err = c.run(ctx, command{timeout: fetchTimeout, dir: store}, args...); err != nil {
		return err
	}
	c.warm(ctx, store, base)
	return nil
}

// Remove deletes a worktree and prunes git's record of it. A worktree someone
// already deleted by hand is only pruned: `worktree remove` refuses a path
// that is not there, and what is left to do is forget it.
//
// A forced remove also deletes a directory git no longer has registered.
// `worktree remove --force` drops the record even when it cannot finish
// deleting the directory (a process still writing into it: "Directory not
// empty"), and every later attempt is then "not a working tree", so the
// session could never close. The leftover's `.git` may name a record git
// has since given to another worktree, so nothing runs git inside it.
func (c *Client) Remove(ctx context.Context, repo domain.Repository, path string, force bool) error {
	store := c.storeOf(repo)
	quick := command{timeout: quickTimeout, dir: store}
	if !c.Exists(path) {
		_, err := c.run(ctx, quick, "worktree", "prune")
		return err
	}
	if force && c.unregistered(ctx, store, path) {
		return c.removeUnregistered(ctx, store, path)
	}
	args := []string{"worktree", "remove"}
	if force {
		args = append(args, "--force")
	}
	args = append(args, path)
	if _, err := c.run(ctx, command{timeout: removeTimeout, dir: store}, args...); err != nil {
		if force && c.unregistered(ctx, store, path) {
			return c.removeUnregistered(ctx, store, path)
		}
		return err
	}
	_, err := c.run(ctx, quick, "worktree", "prune")
	return err
}

// unregistered reports a path git has no worktree record of. A listing that
// fails says nothing, so it is not unregistered and git decides as usual.
func (c *Client) unregistered(ctx context.Context, store, path string) bool {
	record, err := c.recordAt(ctx, store, path)
	return err == nil && record == nil
}

// removeUnregistered deletes a worktree directory git has no record of.
func (c *Client) removeUnregistered(ctx context.Context, store, path string) error {
	if err := os.RemoveAll(path); err != nil {
		return domain.ErrWorktree.WithDetail("remove %s: %v", path, err).WithCause(err)
	}
	_, err := c.run(ctx, command{timeout: quickTimeout, dir: store}, "worktree", "prune")
	return err
}

// Exists reports whether the worktree's directory is still on disk. Only a
// path that is not there is gone: a stat that fails for any other reason (a
// permission, an I/O error) may hide a checkout with work in it, so it counts
// as present and the close goes through its usual checks.
func (c *Client) Exists(path string) bool {
	_, err := os.Stat(path)
	return !errors.Is(err, fs.ErrNotExist)
}

// Dirty reports uncommitted changes, which is what decides whether closing a
// session may remove its worktree.
func (c *Client) Dirty(ctx context.Context, path string) (bool, error) {
	out, err := c.run(ctx, command{timeout: quickTimeout, dir: path}, "status", "--porcelain")
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(out) != "", nil
}

// Push publishes the branch and reports whether anything was actually sent.
// A session that produced no commits is not an error — it simply had nothing
// to say — and `--set-upstream` is harmless when the upstream is already set,
// which keeps this one command instead of a check plus a command that can
// disagree with each other.
//
// A push always needs a credential, so one done for no session is refused
// before it reaches the network: the helper would have nothing to ask for,
// and GitHub's refusal would read as work that could not be pushed.
func (c *Client) Push(ctx context.Context, path, branch string) (bool, error) {
	if c.credentialHelper != "" && domain.SessionOf(ctx) == "" {
		return false, credentialRefused("push", "", "")
	}
	out, err := c.run(ctx, command{timeout: fetchTimeout, dir: path}, "push", "--set-upstream", "origin", branch)
	if err != nil {
		return false, pushRejected(out, err)
	}
	return !strings.Contains(out, "Everything up-to-date"), nil
}

// command is how one git invocation runs.
type command struct {
	timeout time.Duration
	// dir is where git runs; empty is the runner's own directory.
	dir string
	// repo names the repository in a credential failure's detail.
	repo string
}

// run executes git. Every invocation is non-interactive: a git that stops to
// ask a question would hang a session create forever. The session ctx is
// doing work for (domain.WithSession) is handed to the credential helper.
func (c *Client) run(ctx context.Context, how command, args ...string) (string, error) {
	session := domain.SessionOf(ctx)

	// A checkout writes its files from one worker per core: on a large tree
	// that halves the step a person waits on for a worktree (14).
	full := []string{"-c", "advice.detachedHead=false", "-c", "checkout.workers=0"}
	if c.credentialHelper != "" {
		// The empty value clears every helper the system, global and repo
		// config named before it (osxkeychain in Apple's system gitconfig, a
		// person's GCM): only the runner's helper is asked, so a token for
		// one session never comes from a keychain the host account filled.
		//
		// useHttpPath hands the helper the repository's path as well as its
		// host: a session over several repositories holds a token for each,
		// and the path is how the helper says which one git is fetching.
		full = append(full, "-c", "credential.helper=", "-c", "credential.helper="+c.credentialHelper,
			"-c", "credential.useHttpPath=true")
	}
	full = append(full, args...)

	res, err := execx.Run(ctx, execx.Spec{
		Name: c.binary,
		Args: full,
		Dir:  how.dir,
		Env: append(os.Environ(),
			"GIT_TERMINAL_PROMPT=0",
			"GIT_ASKPASS=",
			"GCM_INTERACTIVE=never",
			// Always set, empty or not: the daemon's own environment must never
			// lend a command a session it is not for.
			SessionEnv+"="+session,
		),
		Timeout: how.timeout,
		// git hands the network to helpers (`git-remote-https`, `ssh`) that
		// inherit its output: a cancel kills them with it, and whatever is
		// still holding that output is not waited for past waitDelay.
		KillGroup: true,
		WaitDelay: waitDelay,
		Output:    execx.Combined,
	})
	text := res.Out
	if err != nil {
		verb := strings.Join(args, " ")
		// TimedOut and Canceled read the context git ran under, so a deadline
		// the caller's context already had is reported as a timeout too.
		var failed *execx.Error
		timedOut := errors.As(err, &failed) && failed.TimedOut
		canceled := failed != nil && failed.Canceled
		err = execx.Cause(err)
		switch {
		case timedOut:
			return text, domain.ErrGitCommand.WithDetail(
				"git %s timed out after %s", verb, how.timeout).WithCause(err)
		case canceled:
			// git did not fail: the runner stopped waiting for it. Whatever
			// git printed last is not the reason — it may well be git saying
			// it succeeded — so it is not quoted.
			return text, domain.ErrGitAbandoned.WithDetail(
				"git %s was stopped before it finished, because the runner stopped waiting for it; "+
					"what it had done by then is still on disk and the next attempt takes it over", verb).
				WithCause(context.Canceled)
		case needsCredential(text):
			return text, credentialRefused(verb, how.repo, session).WithCause(err)
		}
		return text, domain.ErrGitCommand.WithDetail("git %s: %s", verb, lastLine(text, err)).WithCause(err)
	}
	return text, nil
}

// credentialSigns are the lines git prints when it gives up for want of a
// credential, each beside the git that prints it. `run` makes the runner's
// helper the only source and forbids a prompt (GIT_TERMINAL_PROMPT=0, an
// empty GIT_ASKPASS), so a helper that answered nothing ends in one of these.
var credentialSigns = []struct{ Git, Sign string }{
	// Upstream git, for a username or a password: "fatal: could not read
	// Username for 'https://github.com': terminal prompts disabled".
	{"upstream git, no username", "could not read Username"},
	{"upstream git, no password", "could not read Password"},
	{"upstream git, the prompt it may not show", "terminal prompts disabled"},
	// Apple's git (/usr/bin/git, the Xcode command-line tools) names neither:
	// "fatal: unable to get password from user".
	{"Apple git", "unable to get password from user"},
	// Any git, when the server refused the credential it was given.
	{"any git, a refused credential", "Authentication failed"},
}

// needsCredential recognises git giving up for want of a credential: it asked
// the helper, got nothing, and was not allowed to ask a person.
func needsCredential(out string) bool {
	for _, s := range credentialSigns {
		if strings.Contains(out, s.Sign) {
			return true
		}
	}
	return false
}

// credentialRefused says what a reader can act on. git's own words
// (credentialSigns) point at a prompt nobody was shown.
func credentialRefused(verb, repo, session string) *problem.Error {
	subject := "the repository"
	if repo != "" {
		subject = repo
	}
	if session == "" {
		return domain.ErrGitCredential.WithDetail(
			"git %s: %s is private and this command runs for no session, so there is no token to ask the "+
				"control plane for; start the session from the console instead", verb, subject)
	}
	return domain.ErrGitCredential.WithDetail(
		"git %s: %s is private and the runner got no token for session %s from the control plane; "+
			"check that the GitHub App installation can see %s and that this host is connected",
		verb, subject, session, subject)
}

// startPoint prefers the store's view of the base branch, so a session is
// cut from what was just fetched rather than from a stale local ref.
func startPoint(base string) string {
	if strings.Contains(base, "/") {
		return base
	}
	return "origin/" + base
}

func pushRejected(out string, err error) error {
	return domain.ErrPushRejected.WithDetail("%s", lastLine(out, err)).WithCause(err)
}

func lastLine(out string, err error) string {
	lines := strings.Split(strings.TrimSpace(out), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		if line := strings.TrimSpace(lines[i]); line != "" {
			return line
		}
	}
	return fmt.Sprint(err)
}
