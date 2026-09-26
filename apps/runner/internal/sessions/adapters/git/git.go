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
// first call clones; later ones fetch and prune. A clone lands whole or not
// at all: it is made beside the mirror and renamed into place.
func (c *Client) Ensure(ctx context.Context, repo, remote string) error {
	if err := domain.ValidateRepo(repo); err != nil {
		return domain.ErrWorktree.WithDetail("%v", err).WithCause(err)
	}
	defer c.lock(repo)()
	mirror := c.layout.Mirror(repo)
	if _, err := os.Stat(filepath.Join(mirror, ".git")); err == nil {
		_, fetchErr := c.run(ctx, command{timeout: fetchTimeout, dir: mirror, repo: repo},
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
	if _, err := c.run(ctx, command{timeout: fetchTimeout, repo: repo},
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
// A path is derived from its session's id, so what is already there is that
// session's own, left by an attempt cut short, and a redelivered create takes
// it over rather than refusing it (recovery.go).
func (c *Client) Add(ctx context.Context, repo, path, branch, base string, newBranch bool) error {
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
	case recreate:
		if err := c.clear(ctx, mirror, path, found); err != nil {
			return err
		}
	case vacant:
	}

	args := []string{"worktree", "add"}
	switch {
	case !newBranch:
		args = append(args, path, branch)
	case c.leftoverBranch(ctx, mirror, branch, startPoint(base)):
		args = append(args, "-B", branch, path, startPoint(base))
	default:
		args = append(args, "-b", branch, path, startPoint(base))
	}
	_, err = c.run(ctx, command{timeout: fetchTimeout, dir: mirror}, args...)
	return err
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
func (c *Client) Push(ctx context.Context, path, branch string) (bool, error) {
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
	killGroupOnCancel(cmd)
	// Whatever is still holding git's output once it has been killed is not
	// waited for past this.
	cmd.WaitDelay = waitDelay
	cmd.Dir = how.dir
	cmd.Env = append(os.Environ(),
		"GIT_TERMINAL_PROMPT=0",
		"GIT_ASKPASS=",
		"GCM_INTERACTIVE=never",
		// Always set, empty or not: the daemon's own environment must never
		// lend a command a session it is not for.
		SessionEnv+"="+session,
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
			return text, credentialRefused(verb, how.repo, session).WithCause(err)
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
