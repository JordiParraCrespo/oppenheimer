package cli

// A cloud session (`session.create` with `cloud`): the task starts in Claude
// Code's cloud with this host's own `claude`, and the host keeps nothing of it
// (product/research/cloud-agents.md §5B). No terminal, no worktree left on
// disk, and nothing the sessions service tracks, so no poll ever reports it
// stopped: the session lives on claude.ai/code from here.

import (
	"context"
	"encoding/base64"
	"os"
	"path/filepath"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/cloud"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// CloudStarter starts a task in Claude Code's cloud from a checkout
// (sessions/adapters/cloud).
type CloudStarter interface {
	Start(ctx context.Context, dir, prompt string) (cloud.Started, error)
}

// createCloud fetches the repository with the frame's own token, checks its
// base out in a scratch directory, runs `claude --cloud` there and reports
// the cloud session's id as `session.started`'s `agentSessionId`, then removes
// the scratch directory. Its progress is the console's usual stepper: host,
// clone, worktree (the scratch checkout), agent (the CLI).
//
// A create sent again while one runs, or after it made the session, does
// nothing: the runner is idempotent by session id, as for any create. A
// failed one may be sent again.
func (h *linkHandler) createCloud(ctx context.Context, m link.SessionCreate) {
	if _, running := h.cloudStarts.LoadOrStore(m.SessionID, true); running {
		return
	}
	fail := func(err error) {
		h.cloudStarts.Delete(m.SessionID)
		h.fail(m.CommandID, err)
		h.reporter.Append(m.SessionID, "session.failed", failurePayload(err))
	}

	steps := newStartSteps(
		func(p link.SessionStepPayload) { h.reporter.Append(m.SessionID, link.SessionStepKind, p) },
		nil, time.Now,
	)
	if len(m.Checkouts) != 1 || m.Prompt == "" || m.Agent != "claude-code" {
		fail(sessionsdomain.ErrInvalidInput.WithDetail(
			"a cloud session is Claude Code with one checkout and a task"))
		return
	}
	if h.app.Worktrees == nil {
		fail(sessionsdomain.ErrInvalidInput.WithDetail("this host has no git to start a cloud session with"))
		return
	}
	checkout := m.Checkouts[0]
	sealed, err := base64.StdEncoding.DecodeString(m.Cloud.Sealed)
	if err != nil {
		fail(sessionsdomain.ErrInvalidInput.WithDetail("the cloud session's token is not base64"))
		return
	}
	token, err := h.app.Pairing.Unseal(sealed)
	if err != nil {
		fail(err)
		return
	}
	repo := sessionsdomain.Repository{
		Tenant:   sessionsdomain.Tenant{Account: h.account(), Workspace: m.WorkspaceID},
		FullName: checkout.RepositoryFullName, GithubID: checkout.GithubRepoID,
	}
	if err := repo.Validate(); err != nil {
		fail(sessionsdomain.ErrInvalidInput.WithDetail("%v", err).WithCause(err))
		return
	}
	if h.app.WorkFolder != nil {
		if err := h.app.WorkFolder.MakeWorkspace(repo.Tenant, m.OrganizationSlug); err != nil {
			fail(err)
			return
		}
	}

	// Git asks the broker for this token by this name: there is no session
	// on the host for a credential ask to name.
	id := preparePrefix + m.CommandID
	h.credentials.Hold(id, string(token), m.Cloud.ExpiresAt)
	defer h.credentials.Forget(id)
	gitCtx := sessionsdomain.WithSession(ctx, id)

	remote := "https://github.com/" + checkout.RepositoryFullName + ".git"
	stage := func(s sessionsdomain.Stage, run func() error) error {
		began := time.Now()
		steps.stage(sessionsdomain.StageEvent{Stage: s, Download: s == sessionsdomain.StageClone && !h.app.Worktrees.Has(repo)})
		if err := run(); err != nil {
			return err
		}
		steps.stage(sessionsdomain.StageEvent{Stage: s, Done: true, Took: time.Since(began)})
		return nil
	}

	if err := stage(sessionsdomain.StageClone, func() error {
		return h.app.Worktrees.Ensure(gitCtx, repo, remote, checkout.BaseBranch)
	}); err != nil {
		fail(err)
		return
	}

	scratch := filepath.Join(os.TempDir(), "oppenheimer-cloud", m.SessionID)
	if err := stage(sessionsdomain.StageWorktree, func() error {
		return h.app.Worktrees.AddDetached(gitCtx, repo, scratch, checkout.BaseBranch)
	}); err != nil {
		fail(err)
		return
	}
	defer func() {
		// Nothing was made in it: the cloud took the commit, not the directory.
		_ = h.app.Worktrees.Remove(context.WithoutCancel(ctx), repo, scratch, true)
	}()

	starter := h.app.Cloud
	if starter == nil {
		starter = cloud.Starter{}
	}
	var started cloud.Started
	if err := stage(sessionsdomain.StageAgent, func() error {
		started, err = starter.Start(ctx, scratch, m.Prompt)
		return err
	}); err != nil {
		fail(err)
		return
	}
	h.reporter.Append(m.SessionID, "session.started", map[string]any{
		"agentSessionId": started.ID,
		"cloudUrl":       started.URL,
		"title":          started.Title,
		"checkouts":      []map[string]any{},
	})
}
