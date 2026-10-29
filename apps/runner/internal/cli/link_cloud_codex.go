package cli

// Codex cloud (`session.create` with `cloud` and the agent `codex`): the
// host starts the task with its own `codex` and ChatGPT sign-in, then reads
// where it stands off `codex cloud list --json` and reports it as the
// session's state. Unlike Claude Code's cloud, whose status only the browser
// extension sees, Codex's CLI answers it, so the host is the one to ask.
//
// The budget. OpenAI publishes no limit for the CLI's cloud task reads
// (`chatgpt.com/backend-api/wham/tasks`, counted against the ChatGPT account
// the host is signed in as). The host asks at most once a minute, and only
// while a task it started in the last week has not settled; one ask is one
// page of twenty tasks, and at most codexCloudPages pages when the tasks it
// watches have fallen further back. A failed ask doubles the wait, up to a
// quarter of an hour, and the first answer brings it back to a minute.

import (
	"context"
	"log/slog"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/adapters/cloud"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

const (
	// codexCloudPoll is how often the host asks Codex about its tasks.
	codexCloudPoll = time.Minute
	// codexCloudPollMax is the longest a run of failed asks backs off to.
	codexCloudPollMax = 15 * time.Minute
	// codexCloudWatchFor is how long a task is watched for: Codex keeps a
	// task's machine recoverable for a week, and a task still running after
	// that is not one the host will see settle.
	codexCloudWatchFor = 7 * 24 * time.Hour
	// codexCloudPages bounds one ask: a hundred of the account's newest tasks.
	codexCloudPages = 5
)

// createCodexCloud runs `codex cloud exec` on the checkout's base branch, in
// the Codex cloud environment named for its repository, reports the task as
// the session's `agentSessionId` and the session as working. Codex takes the
// branch from GitHub, so nothing is fetched or checked out here: the progress
// is the agent's step alone.
func (h *linkHandler) createCodexCloud(
	ctx context.Context,
	m link.SessionCreate,
	ledger cloudLedger,
	stage func(sessionsdomain.Stage, bool, func() error) error,
	fail func(error),
) {
	checkout := m.Checkouts[0]
	var started cloud.Started
	if err := stage(sessionsdomain.StageAgent, false, func() error {
		var err error
		started, err = h.codexCloud().Start(ctx, checkout.RepositoryFullName, checkout.BaseBranch, m.Prompt)
		return err
	}); err != nil {
		fail(err)
		return
	}
	if err := ledger.record(m.SessionID, codexCloudAgent, started, time.Now()); err != nil {
		h.logger.Warn("cloud start not remembered", "session", m.SessionID, "error", err)
	}
	h.reportCloudStarted(m.SessionID, started)
	h.reportCodexStatus(ledger, m.SessionID, cloud.CodexPending)
}

// watchCodexCloud asks Codex where the host's unsettled tasks stand, for as
// long as the daemon lives.
func (h *linkHandler) watchCodexCloud(ctx context.Context) {
	wait := codexCloudPoll
	timer := time.NewTimer(wait)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		}
		if err := h.pollCodexCloud(ctx); err != nil {
			wait = min(wait*2, codexCloudPollMax)
			h.logger.Warn("codex cloud status not read", slog.Duration("next", wait), slog.Any("error", err))
		} else {
			wait = codexCloudPoll
		}
		timer.Reset(wait)
	}
}

// pollCodexCloud reads the account's newest tasks, a page at a time, until
// every unsettled task the host started is found or codexCloudPages is spent,
// and reports each one whose status moved. A task not found stays as it was
// last reported. With nothing to watch, Codex is not asked.
func (h *linkHandler) pollCodexCloud(ctx context.Context) error {
	ledger := newCloudLedger(h.app.Paths.State())
	watched := ledger.codexUnsettled(time.Now().Add(-codexCloudWatchFor))
	if len(watched) == 0 {
		return nil
	}
	want := make(map[string]codexWatch, len(watched))
	for _, w := range watched {
		want[w.TaskID] = w
	}
	cursor := ""
	for range codexCloudPages {
		page, err := h.codexCloud().List(ctx, cursor)
		if err != nil {
			return err
		}
		for _, task := range page.Tasks {
			w, ok := want[task.ID]
			if !ok {
				continue
			}
			delete(want, task.ID)
			if task.Status != w.Status {
				h.reportCodexStatus(ledger, w.SessionID, task.Status)
			}
		}
		if len(want) == 0 || page.Cursor == "" {
			return nil
		}
		cursor = page.Cursor
	}
	return nil
}

// reportCodexStatus is a Codex task's status as the session's log takes it:
// running is the agent working, finished (ready, or already applied) is done,
// and an error is the session failed. A status this runner does not know is
// left unreported, so a newer CLI's word never reads as one of these.
func (h *linkHandler) reportCodexStatus(ledger cloudLedger, sessionID, status string) {
	switch status {
	case cloud.CodexPending:
		h.reporter.Append(sessionID, "agent.observed", map[string]any{"state": "working"})
	case cloud.CodexReady, cloud.CodexApplied:
		h.reporter.Append(sessionID, "agent.observed", map[string]any{"state": "done"})
	case cloud.CodexError:
		h.reporter.Append(sessionID, "session.failed", map[string]any{
			"detail": "Codex cloud reported the task failed; its page on chatgpt.com/codex says why",
		})
	default:
		return
	}
	if err := ledger.reported(sessionID, status); err != nil {
		h.logger.Warn("codex cloud status not remembered", "session", sessionID, "error", err)
	}
}

func (h *linkHandler) codexCloud() CodexCloud {
	if h.app.CodexCloud != nil {
		return h.app.CodexCloud
	}
	return cloud.Codex{}
}
