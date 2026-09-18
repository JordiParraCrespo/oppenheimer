// Package git keeps the fixed workspace layout: one mirror per repository,
// one worktree per session.
//
//	~/oppenheimer-ai/workspaces/<owner>/<repo>/main            the fetch source, never edited
//	~/oppenheimer-ai/workspaces/<owner>/<repo>/worktrees/<slug>  one per session
//
// Credentials never reach this package: git asks the runner's credential
// helper over the local socket when it needs one, so nothing is written to
// disk and nothing is passed on a command line.
package git

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

var _ app.Worktrees = (*Client)(nil)

// Timeouts: a clone of a large repository is slow, a status is not.
const (
	fetchTimeout = 10 * time.Minute
	quickTimeout = 60 * time.Second
)

// Client runs git.
type Client struct {
	layout domain.Layout
	binary string
	// credentialHelper, when set, is the command git calls for a password.
	// It is the runner's own `credential-helper` subcommand.
	credentialHelper string
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
	return &Client{layout: opts.Layout, binary: binary, credentialHelper: opts.CredentialHelper}
}

// Ensure makes sure the repository's mirror exists and is up to date. The
// first call clones; later ones fetch and prune.
func (c *Client) Ensure(ctx context.Context, repo, remote string) error {
	if err := domain.ValidateRepo(repo); err != nil {
		return domain.ErrWorktree.WithDetail("%v", err).WithCause(err)
	}
	mirror := c.layout.Mirror(repo)
	if _, err := os.Stat(filepath.Join(mirror, ".git")); err == nil {
		_, fetchErr := c.run(ctx, fetchTimeout, mirror, "fetch", "--prune", "--tags", "origin")
		return fetchErr
	}
	if remote == "" {
		return domain.ErrWorktree.WithDetail(
			"%s has never been cloned on this host and no remote was given", repo)
	}
	if err := os.MkdirAll(filepath.Dir(mirror), 0o700); err != nil {
		return domain.ErrWorktree.WithDetail("create %s: %v", filepath.Dir(mirror), err).WithCause(err)
	}
	_, err := c.run(ctx, fetchTimeout, "", "clone", remote, mirror)
	return err
}

// Add creates a worktree. A new branch is cut from the base branch as the
// mirror last saw it; an existing branch is checked out as it is.
func (c *Client) Add(ctx context.Context, repo, path, branch, base string, newBranch bool) error {
	mirror := c.layout.Mirror(repo)
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return domain.ErrWorktree.WithDetail("create %s: %v", filepath.Dir(path), err).WithCause(err)
	}
	if _, err := os.Stat(path); err == nil {
		return domain.ErrSessionExists.WithDetail("%s already exists", path)
	}
	args := []string{"worktree", "add"}
	if newBranch {
		args = append(args, "-b", branch, path, startPoint(base))
	} else {
		args = append(args, path, branch)
	}
	_, err := c.run(ctx, fetchTimeout, mirror, args...)
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
	if _, err := c.run(ctx, quickTimeout, mirror, args...); err != nil {
		return err
	}
	_, err := c.run(ctx, quickTimeout, mirror, "worktree", "prune")
	return err
}

// Dirty reports uncommitted changes, which is what decides whether closing a
// session may remove its worktree.
func (c *Client) Dirty(ctx context.Context, path string) (bool, error) {
	out, err := c.run(ctx, quickTimeout, path, "status", "--porcelain")
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
	out, err := c.run(ctx, fetchTimeout, path, "push", "--set-upstream", "origin", branch)
	if err != nil {
		return false, pushRejected(out, err)
	}
	return !strings.Contains(out, "Everything up-to-date"), nil
}

// run executes git in dir. Every invocation is non-interactive: a git that
// stops to ask a question would hang a session create forever.
func (c *Client) run(ctx context.Context, timeout time.Duration, dir string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	full := []string{"-c", "advice.detachedHead=false"}
	if c.credentialHelper != "" {
		// The helper is the runner's own subcommand over the local socket;
		// no token is ever written to a config file or a command line.
		full = append(full, "-c", "credential.helper=", "-c", "credential.helper="+c.credentialHelper)
	}
	full = append(full, args...)

	cmd := exec.CommandContext(ctx, c.binary, full...) //nolint:gosec // fixed binary, arguments built here
	cmd.Dir = dir
	cmd.Env = append(os.Environ(),
		"GIT_TERMINAL_PROMPT=0",
		"GIT_ASKPASS=",
		"GCM_INTERACTIVE=never",
	)
	out, err := cmd.CombinedOutput()
	text := strings.TrimRight(string(out), "\n")
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return text, domain.ErrGitCommand.WithDetail(
				"git %s timed out after %s", strings.Join(args, " "), timeout).WithCause(err)
		}
		return text, domain.ErrGitCommand.WithDetail(
			"git %s: %s", strings.Join(args, " "), lastLine(text, err)).WithCause(err)
	}
	return text, nil
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
