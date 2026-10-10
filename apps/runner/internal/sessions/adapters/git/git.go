// Package git keeps the fixed workspace layout: one mirror per repository,
// one worktree per session.
//
//	~/oppenheimer-ai/workspaces/<owner>/<repo>/main            the fetch source, never edited
//	~/oppenheimer-ai/workspaces/<owner>/<repo>/worktrees/<slug>  one per session
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
	"os"
	"path/filepath"
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
	// waitDelay bounds how long a killed git's output is waited on.
	waitDelay = 5 * time.Second
)

// SessionEnv is the variable the credential helper reads to say which
// session it is asking for. A tmux session carries it in its environment; a
// git command this package runs on a session's behalf carries it here.
const SessionEnv = "OPPENHEIMER_SESSION"

// partialPrefix names a clone in progress, beside the mirror it will become.
// A clone lands under this name and is renamed into place only once it is
// whole, so a clone cut short never leaves a mirror that looks usable.
const partialPrefix = ".partial-main-"

// Client runs git.
type Client struct {
	layout domain.Layout
	binary string
	// credentialHelper, when set, is the command git calls for a password.
	// It is the runner's own `credential-helper` subcommand.
	credentialHelper string

	// repos serialises the work on one mirror. Creates run side by side, and
	// two sessions on a repository this host has never seen would otherwise
	// both clone it, or cut worktrees while the other is fetching.
	mu    sync.Mutex
	repos map[string]*sync.Mutex

	// prewarm keeps a spare worktree per repository (spares.go), held in
	// spares under mu; warming counts the ones being made.
	prewarm bool
	spares  map[string]*spare
	warming sync.WaitGroup

	// deepening holds, under mu, the mirrors cloned shallow whose history is
	// still being fetched (deepen); the channel closes when it lands.
	deepening map[string]chan struct{}
}

// Options configure the client.
type Options struct {
	Layout           domain.Layout
	Binary           string
	CredentialHelper string
	// Spares keeps one worktree per repository checked out ahead of the next
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
		repos: map[string]*sync.Mutex{}, prewarm: opts.Spares, spares: map[string]*spare{},
		deepening: map[string]chan struct{}{},
	}
}

func (c *Client) lock(repo string) func() {
	c.mu.Lock()
	m, ok := c.repos[repo]
	if !ok {
		m = &sync.Mutex{}
		c.repos[repo] = m
	}
	c.mu.Unlock()
	m.Lock()
	return m.Unlock
}

// Has implements app.Worktrees. A clone is made beside the mirror and renamed
// into place once whole, so a mirror with a `.git` is never half a download.
func (c *Client) Has(repo string) bool {
	if domain.ValidateRepo(repo) != nil {
		return false
	}
	_, err := os.Stat(filepath.Join(c.layout.Mirror(repo), ".git"))
	return err == nil
}

// Ensure makes sure the repository's store exists and that ref is fresh in
// it; an empty ref fetches every branch. The first call clones; later ones
// fetch. The store is blobless and has no working tree
// (02-runner §5): a file's contents arrive when a checkout or a command first
// reads them, through the same credential helper. A first clone is shallow at
// ref and gets its history in the background (deepen).
func (c *Client) Ensure(ctx context.Context, repo, remote, ref string) error {
	if err := domain.ValidateRepo(repo); err != nil {
		return domain.ErrWorktree.WithDetail("%v", err).WithCause(err)
	}
	if ref != "" {
		if err := domain.ValidateBranch(ref); err != nil {
			return domain.ErrWorktree.WithDetail("%v", err).WithCause(err)
		}
	}
	defer c.lock(repo)()
	mirror := c.layout.Mirror(repo)
	if _, err := os.Stat(filepath.Join(mirror, ".git")); err == nil {
		if landed := c.deepeningOf(repo); landed != nil {
			// A deepen is fetching every branch right now, from a clone made
			// moments ago: a ref the clone brought is current, and a second
			// fetch beside the deepen would contend for the same refs.
			if ref == "" || c.hasRemoteBranch(ctx, mirror, ref) {
				return nil
			}
			select {
			case <-landed:
			case <-ctx.Done():
				return ctx.Err()
			}
		}
		if err := c.fetch(ctx, repo, mirror, ref); err != nil {
			return err
		}
		// A shallow mirror whose deepen was cut short (a runner restart)
		// gets its history now.
		c.deepen(ctx, repo, mirror)
		return nil
	}
	if remote == "" {
		return domain.ErrWorktree.WithDetail(
			"%s has never been cloned on this host and no remote was given", repo)
	}
	parent := filepath.Dir(mirror)
	if err := os.MkdirAll(parent, 0o700); err != nil {
		return domain.ErrWorktree.WithDetail("create %s: %v", parent, err).WithCause(err)
	}
	// A mirror directory with no .git is what an older runner's cut-short
	// clone left. Empty, it is nothing and goes; with anything in it, it is
	// not ours to delete.
	if err := os.Remove(mirror); err != nil && !os.IsNotExist(err) {
		return domain.ErrWorktree.WithDetail(
			"%s exists but is not a clone of %s; move it aside and start the session again", mirror, repo)
	}
	sweepPartials(parent)

	partial, err := os.MkdirTemp(parent, partialPrefix)
	if err != nil {
		return domain.ErrWorktree.WithDetail("create a directory to clone into: %v", err).WithCause(err)
	}
	// Shallow first: the base's one commit with its files is what a worktree
	// needs, and on a large repository it is a third of the time a blobless
	// clone of the whole history takes (14). The history follows in the
	// background (deepen), leaving the store blobless as it always was. A
	// local path ignores --depth, so a test's clone is whole from the start.
	clone := append(append([]string{}, noMaintenance...), "clone", "--depth=1", "--no-checkout")
	if ref != "" {
		clone = append(clone, "--branch", ref)
	}
	clone = append(clone, remote, partial)
	if _, err := c.run(ctx, command{timeout: fetchTimeout, repo: repo}, clone...); err != nil {
		_ = os.RemoveAll(partial)
		return err
	}
	// Every branch, and the tags: the refspec is what a bare `git fetch` in
	// the session's shell uses afterwards, and a shallow clone narrows it to
	// the one branch it fetched.
	if _, err := c.run(ctx, command{timeout: quickTimeout, dir: partial},
		"config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*"); err != nil {
		_ = os.RemoveAll(partial)
		return err
	}
	if err := os.Rename(partial, mirror); err != nil {
		_ = os.RemoveAll(partial)
		return domain.ErrWorktree.WithDetail("move the clone into %s: %v", mirror, err).WithCause(err)
	}
	c.deepen(ctx, repo, mirror)
	return nil
}

// deepen fetches, in the background, the history a shallow mirror was cloned
// without: every branch's commits and trees, the blobs left to arrive when
// read, as a blobless clone would have had them. It takes no lock, so creates
// go on beside it; Ensure leaves the fetching to it while it runs. ctx's
// session rides along for the token; its end does not.
func (c *Client) deepen(ctx context.Context, repo, mirror string) {
	if _, err := os.Stat(filepath.Join(mirror, ".git", "shallow")); err != nil {
		return
	}
	c.mu.Lock()
	if _, running := c.deepening[repo]; running {
		c.mu.Unlock()
		return
	}
	landed := make(chan struct{})
	c.deepening[repo] = landed
	c.mu.Unlock()

	c.warming.Add(1)
	go func() {
		defer c.warming.Done()
		defer func() {
			c.mu.Lock()
			delete(c.deepening, repo)
			c.mu.Unlock()
			close(landed)
		}()
		ctx := context.WithoutCancel(ctx)
		quick := command{timeout: quickTimeout, dir: mirror}
		// Promised objects are what a blobless clone records: the blobs of
		// older commits stay on the remote until something reads them.
		if _, err := c.run(ctx, quick, "config", "remote.origin.promisor", "true"); err != nil {
			return
		}
		if _, err := c.run(ctx, quick, "config", "remote.origin.partialclonefilter", "blob:none"); err != nil {
			return
		}
		args := append(append([]string{}, noMaintenance...), "fetch", "--unshallow", "--filter=blob:none", "origin")
		_, _ = c.run(ctx, command{timeout: fetchTimeout, dir: mirror, repo: repo}, args...)
	}()
}

// deepeningOf is the channel a running deepen of repo closes, or nil.
func (c *Client) deepeningOf(repo string) chan struct{} {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.deepening[repo]
}

// hasRemoteBranch reports origin/<branch> in mirror.
func (c *Client) hasRemoteBranch(ctx context.Context, mirror, branch string) bool {
	_, err := c.run(ctx, command{timeout: quickTimeout, dir: mirror},
		"rev-parse", "--verify", "--quiet", "refs/remotes/origin/"+branch)
	return err == nil
}

// PrepareRepository gets repo ready for a create that has not been asked for
// yet: its mirror cloned or base fetched, and a spare worktree at base made
// and checked out. It returns once those are done and a first clone's history
// has landed, so the caller's context (the token its git rides on) is live for
// all of it; a create takes the spare as soon as it is ready. A spare already
// there, or being made, is kept.
func (c *Client) PrepareRepository(ctx context.Context, repo, remote, base string) error {
	if err := c.Ensure(ctx, repo, remote, base); err != nil {
		return err
	}
	if s := c.warm(ctx, repo, base); s != nil {
		select {
		case <-s.done:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	// The history a shallow clone left out is fetched under this context's
	// identity too: the caller's token must outlive it. A create meanwhile
	// takes the spare and goes on without it.
	if landed := c.deepeningOf(repo); landed != nil {
		select {
		case <-landed:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

// noMaintenance keeps git from packing or gc-ing the store on the back of a
// session's clone or fetch: that work is git's to do some other time, not while a
// person waits for a terminal.
var noMaintenance = []string{"-c", "maintenance.auto=false", "-c", "gc.auto=0"}

// fetch is the one fetch a create waits on: the ref its worktree is made from,
// or every branch when it names none.
func (c *Client) fetch(ctx context.Context, repo, mirror, ref string) error {
	args := append(append([]string{}, noMaintenance...), "fetch", "--no-tags", "origin")
	if ref == "" {
		args = append(args, "--prune")
	} else {
		args = append(args, "+refs/heads/"+ref+":refs/remotes/origin/"+ref)
	}
	_, err := c.run(ctx, command{timeout: fetchTimeout, dir: mirror, repo: repo}, args...)
	return err
}

// sweepPartials removes clones in progress that no clone is still writing:
// ones older than the longest a clone may take, left by a runner that was
// killed half-way. A younger one may belong to another process cloning the
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
// mirror last saw it; an existing branch is checked out as it is.
//
// A path is derived from its session's id, so what is already there is that
// session's own, left by an attempt cut short, and a redelivered create takes
// it over rather than refusing it (recovery.go).
func (c *Client) Add(ctx context.Context, repo, path, branch, base string, newBranch bool) error {
	if newBranch {
		c.awaitSpare(ctx, repo)
	}
	defer c.lock(repo)()
	mirror := c.layout.Mirror(repo)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return domain.ErrWorktree.WithDetail("create %s: %v", filepath.Dir(path), err).WithCause(err)
	}
	found, err := c.inspect(ctx, mirror, path, branch)
	if err != nil {
		return err
	}
	switch found.kind {
	case refuse:
		return domain.ErrSessionExists.WithDetail("%s", found.reason)
	case adopt:
		return c.adopt(ctx, mirror, path, found)
	case claimed:
		if !newBranch {
			return domain.ErrSessionExists.WithDetail("%s already exists, on a detached HEAD", path)
		}
		if err := c.checkoutSession(ctx, mirror, path, branch, base); err != nil {
			return err
		}
		c.warm(ctx, repo, base)
		return nil
	case recreate:
		if err := c.clear(ctx, mirror, path, found); err != nil {
			return err
		}
	case vacant:
	}
	if newBranch && c.claim(ctx, repo, mirror, path, branch, base) {
		c.warm(ctx, repo, base)
		return nil
	}

	args := []string{"worktree", "add"}
	switch {
	case !newBranch:
		args = append(args, path, branch)
	// --no-track: a session's branch is pushed to a branch of its own
	// (push --set-upstream), never pulled from its base, and git's guess at
	// tracking the base fails outright when two refspecs map onto it.
	case c.leftoverBranch(ctx, mirror, branch, startPoint(base)):
		args = append(args, "--no-track", "-B", branch, path, startPoint(base))
	default:
		args = append(args, "--no-track", "-b", branch, path, startPoint(base))
	}
	if _, err = c.run(ctx, command{timeout: fetchTimeout, dir: mirror}, args...); err != nil {
		return err
	}
	c.warm(ctx, repo, base)
	return nil
}

// Prepare makes the directory this repository's worktrees are created in and
// answers it. The session's terminal is started there before the worktree
// exists, so the reader is in the pane while the clone is still running.
func (c *Client) Prepare(ctx context.Context, repo string) (string, error) {
	if err := domain.ValidateRepo(repo); err != nil {
		return "", domain.ErrInvalidInput.WithDetail("%v", err).WithCause(err)
	}
	dir := filepath.Dir(c.layout.Worktree(repo, "x"))
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", domain.ErrWorktree.WithDetail("create %s: %v", dir, err).WithCause(err)
	}
	return dir, nil
}

// Remove deletes a worktree and prunes git's record of it.
func (c *Client) Remove(ctx context.Context, repo, path string, force bool) error {
	mirror := c.layout.Mirror(repo)
	args := []string{"worktree", "remove"}
	if force {
		args = append(args, "--force")
	}
	args = append(args, path)
	quick := command{timeout: quickTimeout, dir: mirror}
	if _, err := c.run(ctx, quick, args...); err != nil {
		return err
	}
	_, err := c.run(ctx, quick, "worktree", "prune")
	return err
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
		full = append(full, "-c", "credential.helper=", "-c", "credential.helper="+c.credentialHelper)
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

// startPoint prefers the mirror's view of the base branch, so a session is
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
