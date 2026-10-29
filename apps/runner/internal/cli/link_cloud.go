package cli

// A cloud session (`session.create` with `cloud`): the task starts in its
// agent's cloud with this host's own CLI, and the host keeps nothing of it
// (product/research/cloud-agents.md §5B). No terminal, no worktree left on
// disk, and nothing the sessions service tracks, so no poll of tmux ever
// reports it stopped. Claude Code's lives on claude.ai/code from here;
// Codex's on chatgpt.com/codex, and the host reads where it stands
// (link_cloud_codex.go).

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

// The catalog ids a cloud session can name: the agents a host starts in
// their vendor's cloud (`HOST_CLOUD_AGENT_IDS` in @oppenheimer/shared).
const (
	claudeCloudAgent = "claude-code"
	codexCloudAgent  = "codex"
)

// CloudStarter starts a task in Claude Code's cloud from a checkout
// (sessions/adapters/cloud).
type CloudStarter interface {
	Start(ctx context.Context, dir, prompt string) (cloud.Started, error)
}

// CodexCloud starts tasks in Codex cloud and reads their status
// (sessions/adapters/cloud).
type CodexCloud interface {
	Start(ctx context.Context, repository, branch, prompt string) (cloud.Started, error)
	List(ctx context.Context, cursor string) (cloud.CodexPage, error)
}

// stageFunc runs one step of a start between its stepper events: began, and
// done with how long it took. download says the step fetches a repository
// this host has not had before.
type stageFunc func(stage sessionsdomain.Stage, download bool, run func() error) error

// cloudStartFunc is one agent's own start of a cloud session, given what
// createCloud shares: the ledger it records in, the stepper and the failure.
type cloudStartFunc func(h *linkHandler, ctx context.Context, m link.SessionCreate, ledger cloudLedger, stage stageFunc, fail func(error))

// cloudStarters is the agents a host starts in their vendor's cloud, each
// with its own start. A new one is a start and its line here.
var cloudStarters = map[string]cloudStartFunc{
	claudeCloudAgent: (*linkHandler).createClaudeCloud,
	codexCloudAgent:  (*linkHandler).createCodexCloud,
}

// createCloud starts the session in its agent's cloud: what every agent
// shares is here (the create sent again, the ledger, the steps, the failure),
// and what differs is the agent's own start in cloudStarters, which reports
// the cloud session's id as `session.started`'s `agentSessionId`.
//
// A create sent again while one runs does nothing; one sent again after it
// made the session — even across a restart that lost the report — reports the
// session it made, from the ledger, and starts nothing. The runner is
// idempotent by session id, as for any create. A failed one may be sent again.
func (h *linkHandler) createCloud(ctx context.Context, m link.SessionCreate) {
	if _, running := h.cloudStarts.LoadOrStore(m.SessionID, true); running {
		return
	}
	ledger := newCloudLedger(h.app.Paths.State())
	if started, ok := ledger.find(m.SessionID); ok {
		h.reportCloudStarted(m.SessionID, started)
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
	stage := stageFunc(func(s sessionsdomain.Stage, download bool, run func() error) error {
		began := time.Now()
		steps.stage(sessionsdomain.StageEvent{Stage: s, Download: download})
		if err := run(); err != nil {
			return err
		}
		steps.stage(sessionsdomain.StageEvent{Stage: s, Done: true, Took: time.Since(began)})
		return nil
	})
	start, known := cloudStarters[m.Agent]
	if len(m.Checkouts) != 1 || m.Prompt == "" || !known {
		fail(sessionsdomain.ErrInvalidInput.WithDetail(
			"a cloud session is Claude Code or Codex with one checkout and a task"))
		return
	}
	start(h, ctx, m, ledger, stage, fail)
}

// createClaudeCloud fetches the repository with the frame's own token, checks
// its base out in a scratch directory, runs `claude --cloud` there, reports
// the cloud session it made and removes the scratch directory. Its progress
// is the console's usual stepper: clone, worktree (the scratch checkout),
// agent (the CLI).
func (h *linkHandler) createClaudeCloud(
	ctx context.Context,
	m link.SessionCreate,
	ledger cloudLedger,
	stage stageFunc,
	fail func(error),
) {
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
	if err := stage(sessionsdomain.StageClone, !h.app.Worktrees.Has(repo), func() error {
		return h.app.Worktrees.Ensure(gitCtx, repo, remote, checkout.BaseBranch)
	}); err != nil {
		fail(err)
		return
	}

	scratch := filepath.Join(os.TempDir(), "oppenheimer-cloud", m.SessionID)
	if err := stage(sessionsdomain.StageWorktree, false, func() error {
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
	if err := stage(sessionsdomain.StageAgent, false, func() error {
		started, err = starter.Start(ctx, scratch, m.Prompt)
		return err
	}); err != nil {
		fail(err)
		return
	}
	// Remembered before it is reported: a report lost with a restart is
	// recovered from here, never by starting again.
	if err := ledger.record(m.SessionID, m.Agent, started, time.Now()); err != nil {
		h.logger.Warn("cloud start not remembered", "session", m.SessionID, "error", err)
	}
	h.reportCloudStarted(m.SessionID, started)
}

// reportCloudStarted is `session.started` for a cloud session: its id is the
// agent's session, and it has no checkout on this host.
func (h *linkHandler) reportCloudStarted(sessionID string, started cloud.Started) {
	h.reporter.Append(sessionID, "session.started", map[string]any{
		"agentSessionId": started.ID,
		"cloudUrl":       started.URL,
		"title":          started.Title,
		"checkouts":      []map[string]any{},
	})
}
