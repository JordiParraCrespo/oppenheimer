package cli

// The session verbs of the link, mapped onto the sessions service: what
// `session.create`, `stop`, `restart`, `close`, `window.open`, `window.close`,
// `host.preflight` and `host.update` do on this host. The socket, the epoch and
// the event keys are `link.go`'s; the PTYs are `link_attachments.go`'s.

import (
	"context"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	updapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
)

// sessionStepKind is the event a step of a starting session is logged as,
// with the payload `{ step, status }`. The control plane keeps it without
// folding it (an unknown kind moves nothing but `lastEventAt`); the console
// reads it back off the log to draw the provisioning steps.
const sessionStepKind = "session.step"

func (h *linkHandler) create(ctx context.Context, m link.SessionCreate) {
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
	// The host has the session: the first of the steps the console draws
	// while it starts (05). The rest are reported by the service as they run.
	step := func(s sessionsdomain.Step, status sessionsdomain.StepStatus) {
		h.reporter.Append(m.SessionID, sessionStepKind, map[string]any{"step": s, "status": status})
	}
	step(sessionsdomain.StepHost, sessionsdomain.StepDone)
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
		Progress: step,
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
