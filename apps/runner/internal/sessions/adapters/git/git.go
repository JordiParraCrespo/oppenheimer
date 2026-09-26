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
// that is how the helper says whose token it wants.
package git

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

var _ app.Worktrees = (*Client)(nil)

// Timeouts: a clone of a large repository is slow, a status is not.
const (
	fetchTimeout = 10 * time.Minute
	quickTimeout = 60 * time.Second
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
}

// Options configure the client.
type Options struct {
	Layout           domain.Layout
	Binary           string
	CredentialHelper string
}

// New builds the client.
func New(opts Options) *Client {
	binary := opts.Binary
	if binary == "" {
		binary = "git"
	}
	return &Client{
		layout: opts.Layout, binary: binary, credentialHelper: opts.CredentialHelper,
		repos: map[string]*sync.Mutex{},
	}
}

// lock takes the repository's lock and returns its release.
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

// Ensure makes sure the repository's mirror exists and is up to date. The
// first call clones; later ones fetch and prune. session is who the clone or
// fetch is for, which is what lets the credential helper answer for a private
// repository before the session exists anywhere else.
func (c *Client) Ensure(ctx context.Context, repo, remote, session string) error {
	if err := domain.ValidateRepo(repo); err != nil {
		return domain.ErrWorktree.WithDetail("%v", err).WithCause(err)
	}
	defer c.lock(repo)()
	mirror := c.layout.Mirror(repo)
	if _, err := os.Stat(filepath.Join(mirror, ".git")); err == nil {
		_, fetchErr := c.run(ctx, command{timeout: fetchTimeout, dir: mirror, session: session, repo: repo},
			"fetch", "--prune", "--tags", "origin")
		return fetchErr
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
	if _, err := c.run(ctx, command{timeout: fetchTimeout, session: session, repo: repo},
		"clone", remote, partial); err != nil {
		_ = os.RemoveAll(partial)
		return err
	}
	if err := os.Rename(partial, mirror); err != nil {
		_ = os.RemoveAll(partial)
		return domain.ErrWorktree.WithDetail("move the clone into %s: %v", mirror, err).WithCause(err)
	}
	return nil
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
// Add is idempotent, because a create the link redelivers after a reconnect
// runs it again: the path is derived from the session id, so a worktree
// already registered there on the same branch is this session's own, left by
// the attempt that was cut short, and is taken over rather than refused.
func (c *Client) Add(ctx context.Context, repo, path, branch, base string, newBranch bool) error {
	defer c.lock(repo)()
	mirror := c.layout.Mirror(repo)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return domain.ErrWorktree.WithDetail("create %s: %v", filepath.Dir(path), err).WithCause(err)
	}
	quick := command{timeout: quickTimeout, dir: mirror}

	registered, err := c.worktreeAt(ctx, mirror, path)
	if err != nil {
		return err
	}
	if registered != nil {
		if registered.branch != "refs/heads/"+branch {
			return domain.ErrSessionExists.WithDetail("%s already exists, on %s", path,
				strings.TrimPrefix(orDetached(registered.branch), "refs/heads/"))
		}
		if _, statErr := os.Stat(path); statErr == nil {
			return c.adopt(ctx, mirror, path, registered)
		}
		// Registered, but the directory is gone: git's record is all that is
		// left, and it is in the way of a fresh add. A lock left by a killed
		// add keeps prune from dropping it, so the lock goes first.
		if registered.locked {
			_, _ = c.run(ctx, quick, "worktree", "unlock", path)
		}
		if _, err := c.run(ctx, quick, "worktree", "prune"); err != nil {
			return err
		}
	} else if _, err := os.Stat(path); err == nil {
		// On disk and unknown to git. An empty directory is what a killed add
		// can leave before it registers anything; anything else is not ours.
		if os.Remove(path) != nil {
			return domain.ErrSessionExists.WithDetail("%s already exists", path)
		}
	}

	args := []string{"worktree", "add"}
	switch {
	case !newBranch:
		args = append(args, path, branch)
	case c.reusableBranch(ctx, mirror, branch, startPoint(base)):
		// The branch is there from an attempt that created it and then died
		// before the worktree did; it holds nothing the start point does not,
		// so resetting it to the start point loses nothing.
		args = append(args, "-B", branch, path, startPoint(base))
	default:
		args = append(args, "-b", branch, path, startPoint(base))
	}
	_, err = c.run(ctx, command{timeout: fetchTimeout, dir: mirror}, args...)
	return err
}

// adopt takes over a worktree an earlier attempt registered. One that git
// itself still holds locked as "initializing" was killed during `worktree
// add`, possibly before its checkout finished: the lock goes and the checkout
// is completed, which is exactly what the killed add would have done next.
func (c *Client) adopt(ctx context.Context, mirror, path string, registered *worktreeEntry) error {
	if !registered.locked || registered.lockReason != "initializing" {
		return nil
	}
	if _, err := c.run(ctx, command{timeout: quickTimeout, dir: mirror}, "worktree", "unlock", path); err != nil {
		return err
	}
	_, err := c.run(ctx, command{timeout: fetchTimeout, dir: path}, "reset", "--hard", "--quiet")
	return err
}

// reusableBranch reports whether branch already exists, is checked out
// nowhere, and has no commit the start point lacks.
func (c *Client) reusableBranch(ctx context.Context, mirror, branch, start string) bool {
	quick := command{timeout: quickTimeout, dir: mirror}
	if _, err := c.run(ctx, quick, "rev-parse", "--verify", "--quiet", "refs/heads/"+branch); err != nil {
		return false
	}
	entries, err := c.worktrees(ctx, mirror)
	if err != nil {
		return false
	}
	for _, entry := range entries {
		if entry.branch == "refs/heads/"+branch {
			return false
		}
	}
	_, err = c.run(ctx, quick, "merge-base", "--is-ancestor", "refs/heads/"+branch, start)
	return err == nil
}

// worktreeEntry is one record of `git worktree list --porcelain`.
type worktreeEntry struct {
	path       string
	branch     string
	locked     bool
	lockReason string
}

// worktrees lists what git has registered for the mirror.
func (c *Client) worktrees(ctx context.Context, mirror string) ([]worktreeEntry, error) {
	out, err := c.run(ctx, command{timeout: quickTimeout, dir: mirror}, "worktree", "list", "--porcelain")
	if err != nil {
		return nil, err
	}
	var entries []worktreeEntry
	for _, block := range strings.Split(out, "\n\n") {
		var entry worktreeEntry
		for _, line := range strings.Split(block, "\n") {
			key, value, _ := strings.Cut(strings.TrimSpace(line), " ")
			switch key {
			case "worktree":
				entry.path = value
			case "branch":
				entry.branch = value
			case "locked":
				entry.locked, entry.lockReason = true, value
			}
		}
		if entry.path != "" {
			entries = append(entries, entry)
		}
	}
	return entries, nil
}

// worktreeAt is git's record of the worktree at path, or nil.
func (c *Client) worktreeAt(ctx context.Context, mirror, path string) (*worktreeEntry, error) {
	entries, err := c.worktrees(ctx, mirror)
	if err != nil {
		return nil, err
	}
	want := canonical(path)
	for i := range entries {
		if canonical(entries[i].path) == want {
			return &entries[i], nil
		}
	}
	return nil, nil
}

// canonical resolves symlinks in path's directory, which git has already
// done in what it reports (macOS's /var is /private/var). The last element
// is left as it is: the directory itself may be gone.
func canonical(path string) string {
	dir, base := filepath.Split(filepath.Clean(path))
	if resolved, err := filepath.EvalSymlinks(dir); err == nil {
		dir = resolved
	}
	return filepath.Join(dir, base)
}

func orDetached(branch string) string {
	if branch == "" {
		return "a detached HEAD"
	}
	return branch
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
// disagree with each other. session is who the push is for, as in Ensure.
func (c *Client) Push(ctx context.Context, path, branch, session string) (bool, error) {
	out, err := c.run(ctx, command{timeout: fetchTimeout, dir: path, session: session},
		"push", "--set-upstream", "origin", branch)
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
	// session is who the command is for, handed to the credential helper.
	session string
	// repo names the repository in a credential failure's detail.
	repo string
}

// run executes git. Every invocation is non-interactive: a git that stops to
// ask a question would hang a session create forever.
func (c *Client) run(ctx context.Context, how command, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, how.timeout)
	defer cancel()

	full := []string{"-c", "advice.detachedHead=false"}
	if c.credentialHelper != "" {
		// The helper is the runner's own subcommand over the local socket;
		// no token is ever written to a config file or a command line.
		full = append(full, "-c", "credential.helper=", "-c", "credential.helper="+c.credentialHelper)
	}
	full = append(full, args...)

	cmd := exec.CommandContext(ctx, c.binary, full...) //nolint:gosec // fixed binary, arguments built here
	cmd.Dir = how.dir
	cmd.Env = append(os.Environ(),
		"GIT_TERMINAL_PROMPT=0",
		"GIT_ASKPASS=",
		"GCM_INTERACTIVE=never",
		// Always set, empty or not: the daemon's own environment must never
		// lend a command a session it is not for.
		SessionEnv+"="+how.session,
	)
	out, err := cmd.CombinedOutput()
	text := strings.TrimRight(string(out), "\n")
	if err != nil {
		verb := strings.Join(args, " ")
		switch {
		case errors.Is(ctx.Err(), context.DeadlineExceeded):
			return text, domain.ErrGitCommand.WithDetail(
				"git %s timed out after %s", verb, how.timeout).WithCause(err)
		case errors.Is(ctx.Err(), context.Canceled):
			// git did not fail: the runner stopped waiting for it. Whatever
			// git printed last is not the reason — it may well be git saying
			// it succeeded — so it is not quoted.
			return text, domain.ErrGitAbandoned.WithDetail(
				"git %s was stopped before it finished, because the runner stopped waiting for it; "+
					"what it had done by then is still on disk and the next attempt takes it over", verb).
				WithCause(context.Canceled)
		case needsCredential(text):
			return text, credentialRefused(verb, how).WithCause(err)
		}
		return text, domain.ErrGitCommand.WithDetail("git %s: %s", verb, lastLine(text, err)).WithCause(err)
	}
	return text, nil
}

// needsCredential recognises git giving up for want of a credential: it asked
// the helper, got nothing, and was not allowed to ask a person.
func needsCredential(out string) bool {
	for _, sign := range []string{
		"could not read Username",
		"could not read Password",
		"terminal prompts disabled",
		"Authentication failed",
	} {
		if strings.Contains(out, sign) {
			return true
		}
	}
	return false
}

// credentialRefused says what a reader can act on. git's own words — "could
// not read Username" — point at a prompt nobody was shown.
func credentialRefused(verb string, how command) *problem.Error {
	subject := "the repository"
	if how.repo != "" {
		subject = how.repo
	}
	if how.session == "" {
		return domain.ErrGitCredential.WithDetail(
			"git %s: %s is private and this command runs for no session, so there is no token to ask the "+
				"control plane for; start the session from the console instead", verb, subject)
	}
	return domain.ErrGitCredential.WithDetail(
		"git %s: %s is private and the runner got no token for session %s from the control plane; "+
			"check that the GitHub App installation can see %s and that this host is connected",
		verb, subject, how.session, subject)
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
