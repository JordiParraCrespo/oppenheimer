package cli

// Codex cloud (`session.create` with `cloud` and the agent `codex`): the
// host starts a thread in Codex cloud with its own ChatGPT sign-in
// (cloud.Codex), then reads where the thread's newest turn stands and reports
// it as the session's state.
//
// The budget. OpenAI publishes no limit for Codex cloud; it counts against
// the ChatGPT account the host is signed in as. The host asks at most once a
// minute, one call per thread it started in the last week that has not
// settled. A failed round doubles the wait, up to a quarter of an hour, and
// the first answer brings it back to a minute; ChatGPT's own "wait" pauses
// the account in the adapter.

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
)

// createCodexCloud starts a Codex cloud thread for the checkout's repository,
// from its base branch, in the environment the create names or else Codex's
// default with the repository (cloud.Codex.Start), and reports the thread as
// the session's `agentSessionId` and the session as working. Codex checks the
// repository out itself, so nothing is fetched here: the progress is the
// agent's step alone.
func (h *linkHandler) createCodexCloud(
	ctx context.Context,
	m link.SessionCreate,
	ledger cloudLedger,
	stage stageFunc,
	fail func(error),
) {
	checkout := m.Checkouts[0]
	var started cloud.Started
	if err := stage(sessionsdomain.StageAgent, false, func() error {
		var err error
		started, err = h.codexCloud().Start(ctx, checkout.RepositoryFullName, checkout.BaseBranch, m.Prompt, m.CodexEnvironment)
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

// pollCodexCloud asks Codex where each unsettled thread the host started
// stands, and reports each one whose status moved. A thread it could not read
// stays as it was last reported; the first refusal ends the round, since the
// next ask would meet it too. With nothing to watch, Codex is not asked.
func (h *linkHandler) pollCodexCloud(ctx context.Context) error {
	ledger := newCloudLedger(h.app.Paths.State())
	watched := ledger.unsettled(codexCloudAgent, cloud.CodexSettled, time.Now().Add(-codexCloudWatchFor))
	for _, w := range watched {
		status, err := h.codexCloud().Status(ctx, w.ID)
		if err != nil {
			return err
		}
		if status != w.Status {
			h.reportCodexStatus(ledger, w.SessionID, status)
		}
	}
	return nil
}

// reportCodexStatus is a Codex task's status as the session's log takes it:
// running is the agent working, finished (ready, or already applied) is done,
// and an error is the session failed. A status this runner does not know is
// left unreported, so a newer CLI's word never reads as one of these.
//
// The ledger remembers a status only once the control plane has acked its
// event: one held in memory when the runner ends is reported again by the
// next poll, never lost behind a ledger that says it was sent. While it waits
// for that ack, a poll that sees the same status again sends nothing more.
func (h *linkHandler) reportCodexStatus(ledger cloudLedger, sessionID, status string) {
	kind, payload, known := codexStatusEvent(status)
	if !known {
		return
	}
	if waiting, ok := h.codexReporting.Load(sessionID); ok && waiting == status {
		return
	}
	h.codexReporting.Store(sessionID, status)
	h.reporter.AppendSettled(sessionID, kind, payload, func() {
		h.codexReporting.CompareAndDelete(sessionID, status)
		if err := ledger.reported(sessionID, status); err != nil {
			h.logger.Warn("codex cloud status not remembered", "session", sessionID, "error", err)
		}
	})
}

// codexStatusEvent is the log entry a Codex status is reported as, or false
// for a status this runner does not know.
func codexStatusEvent(status string) (string, map[string]any, bool) {
	switch status {
	case cloud.CodexPending:
		return "agent.observed", map[string]any{"state": "working"}, true
	case cloud.CodexReady, cloud.CodexApplied:
		return "agent.observed", map[string]any{"state": "done"}, true
	case cloud.CodexError:
		return "session.failed", map[string]any{
			"detail": "Codex cloud reported the task failed or stopped; its thread in Codex says why",
		}, true
	}
	return "", nil, false
}

func (h *linkHandler) codexCloud() CodexCloud {
	if h.app.CodexCloud != nil {
		return h.app.CodexCloud
	}
	return cloud.Codex{}
}
