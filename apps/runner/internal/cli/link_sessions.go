package cli

// The session verbs of the link, mapped onto the sessions service: what
// `session.create`, `stop`, `restart`, `close`, `window.open`, `window.close`,
// `host.preflight` and `host.update` do on this host. The socket, the epoch and
// the event keys are `link.go`'s; the PTYs are `link_attachments.go`'s.

import (
	"context"
	"log/slog"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	updapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
)

// startCreate runs a create beside the read loop. A clone takes as long as
// the repository is big, and while it runs the loop must keep reading: the
// pongs that keep the link up and the `credentials.grant` a private clone is
// waiting on both arrive on it (#77, #79).
func (h *linkHandler) startCreate(m link.SessionCreate) {
	h.mu.Lock()
	if _, running := h.creating[m.SessionID]; running {
		h.mu.Unlock()
		h.logger.Info("session.create redelivered while the first is still running; joining it",
			slog.String("session", m.SessionID), slog.String("command", m.CommandID))
		return
	}
	h.creating[m.SessionID] = nil
	h.mu.Unlock()

	life := h.life
	if life == nil {
		life = context.Background()
	}
	go func() {
		h.create(life, m)
		h.drainCreate(m.SessionID)
	}()
}

// afterCreate runs a command for a session now or, while that session's
// create is running, once it has ended — in the order the commands arrived,
// which is the order the control plane sent them in.
func (h *linkHandler) afterCreate(sessionID string, fn func()) {
	h.mu.Lock()
	if queued, running := h.creating[sessionID]; running {
		h.creating[sessionID] = append(queued, fn)
		h.mu.Unlock()
		return
	}
	h.mu.Unlock()
	fn()
}

// drainCreate runs what waited on a create, then lets later commands run
// directly. The entry goes only once the queue is empty, under the lock, so
// a command arriving during the drain queues behind the ones before it.
func (h *linkHandler) drainCreate(sessionID string) {
	for {
		h.mu.Lock()
		queued := h.creating[sessionID]
		if len(queued) == 0 {
			delete(h.creating, sessionID)
			h.mu.Unlock()
			return
		}
		h.creating[sessionID] = nil
		h.mu.Unlock()
		for _, fn := range queued {
			fn()
		}
	}
}

func (h *linkHandler) create(ctx context.Context, m link.SessionCreate) {
	steps := newStartSteps(func(p link.SessionStepPayload) {
		h.reporter.Append(m.SessionID, link.SessionStepKind, p)
	}, time.Now)
	agent, ok := sessionsdomain.AgentFromCatalogID(m.Agent)
	if !ok {
		h.fail(m.CommandID, sessionsdomain.ErrInvalidInput.WithDetail("unknown agent %q", m.Agent))
		return
	}
	// One checkout, exactly: this runner's session service makes one worktree
	// (its layout is still `<repo>/worktrees/<slug>`, not yet note 10's), so a
	// frame with none has nothing to check out and a frame with several would
	// have its extra rows silently dropped. Both are refused with the reason, so
	// the control plane records a failed launch rather than a partial one.
	if len(m.Checkouts) != 1 {
		h.fail(m.CommandID, sessionsdomain.ErrInvalidInput.WithDetail(
			"this runner makes sessions with exactly one checkout; the frame carried %d", len(m.Checkouts)))
		return
	}
	first := m.Checkouts[0]
	// The clone asks for a token before the session is recorded anywhere on
	// this host; this is how the broker knows which checkout it is for.
	if h.credentials != nil {
		defer h.credentials.Creating(m.SessionID, first.CheckoutID, first.GithubRepoID)()
	}
	session, err := h.app.Sessions.Create(ctx, sessionsapp.CreateInput{
		ID:         m.SessionID,
		Repo:       first.RepositoryFullName,
		Remote:     "https://github.com/" + first.RepositoryFullName + ".git",
		BaseBranch: first.BaseBranch,
		Branch:     m.Branch,
		Name:       m.SessionSlug,
		Agent:      agent,
		Launch: sessionsdomain.Launch{
			Model: m.Launch.Model, Permission: m.Launch.Permission, Effort: m.Launch.Effort, Prompt: m.Prompt,
		},
		CheckoutID: first.CheckoutID, GithubRepoID: first.GithubRepoID,
		Progress: steps.stage,
	})
	if err != nil {
		h.fail(m.CommandID, err)
		h.reporter.Append(m.SessionID, "session.failed", failurePayload(err))
		return
	}
	h.reporter.Append(session.ID, "session.started", map[string]any{
		"checkouts": []map[string]any{{
			"checkoutId": first.CheckoutID, "branch": session.Branch, "path": session.Worktree, "mode": "worktree",
		}},
	})
}

func (h *linkHandler) lifecycle(ctx context.Context, m link.SessionCommand) {
	var err error
	switch m.Type {
	case "session.stop":
		h.mu.Lock()
		h.decided[m.SessionID] = true
		h.mu.Unlock()
		if _, err = h.app.Sessions.Stop(ctx, m.SessionID); err != nil {
			h.mu.Lock()
			delete(h.decided, m.SessionID)
			h.mu.Unlock()
		}
	case "session.restart":
		var session sessionsdomain.Session
		if session, err = h.app.Sessions.Restart(ctx, m.SessionID); err == nil {
			h.reporter.Append(session.ID, "session.restarted", map[string]any{})
		}
	case "session.close":
		_, err = h.app.Sessions.Close(ctx, m.SessionID, sessionsapp.CloseInput{Push: true, Force: m.AcceptUnpushedWork})
		h.credentials.Forget(m.SessionID)
	case "session.window.open":
		_, err = h.app.Sessions.OpenWindow(ctx, m.SessionID)
	case "session.window.close":
		err = h.app.Sessions.CloseWindow(ctx, m.SessionID, m.Window)
	}
	if err != nil {
		h.fail(m.CommandID, err)
	}
}

// preflight re-collects the host facts and reports them at once, as a
// heartbeat, which is the shape the control plane already reads them in.
func (h *linkHandler) preflight(ctx context.Context, commandID string) {
	if _, err := h.app.Host.Preflight(ctx); err != nil {
		h.fail(commandID, err)
	}
	beat, err := h.Heartbeat(ctx)
	if err != nil {
		h.fail(commandID, err)
		return
	}
	beat.Type = "heartbeat"
	_ = h.client.Send(beat)
}

// update applies a version the control plane asks for: the pin and the safe
// window are the control plane's to override here, the signature and the
// digest never are (09 §5).
func (h *linkHandler) update(ctx context.Context, m link.HostUpdate) {
	if h.app.Updates == nil {
		h.fail(m.CommandID, sessionsdomain.ErrInvalidInput.WithDetail("this host is not paired"))
		return
	}
	if m.Version != "" {
		if _, err := h.app.Pairing.SetPin(m.Version); err != nil {
			h.fail(m.CommandID, err)
			return
		}
	}
	if _, err := h.app.Updates.Apply(ctx, updapp.ApplyOptions{Force: true}); err != nil {
		h.fail(m.CommandID, err)
	}
}
