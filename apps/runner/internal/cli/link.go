package cli

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	updapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// ptyRead is the PTY read buffer, 02-runner §5's 32 KB: one read is one frame.
const ptyRead = 32 * 1024

// linkHandler is what the link does to this host: the composition root's
// mapping from 01's messages onto the session service. It owns the open
// attachments — the PTYs behind the browser's terminals — because they are
// the one thing that is neither a session (they outlive none) nor the link
// (they outlive no epoch).
type linkHandler struct {
	app      *App
	identity pairdomain.Identity
	logger   *slog.Logger
	client   *link.Client
	reporter *link.Reporter

	credentials *credentialBroker

	mu          sync.Mutex
	attachments map[uint32]*attachment
	epoch       uint64
}

type attachment struct {
	id        uint32
	sessionID string
	window    int
	pty       sessionsapp.Attachment
	cancel    context.CancelFunc
	flow      *flowWindow
}

// newRunID mints the id every event key of this process starts with.
func newRunID() (string, error) {
	raw := make([]byte, 6)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return "run-" + hex.EncodeToString(raw), nil
}

// linkLoop keeps the control-plane link open for the life of the daemon.
func (a *App) linkLoop(ctx context.Context, logger *slog.Logger, identity pairdomain.Identity) {
	runID, err := newRunID()
	if err != nil {
		logger.Error("could not mint a run id; the link stays down", slog.Any("error", err))
		return
	}
	handler := &linkHandler{app: a, identity: identity, logger: logger, attachments: map[uint32]*attachment{}}
	client, err := link.New(link.Options{
		ControlPlaneURL: identity.ControlPlaneURL,
		Token:           a.Pairing.BootToken,
		Fingerprint:     identity.Fingerprint,
		Handler:         handler,
		UserAgent:       "oppenheimer-runner/" + a.Version,
		Logger:          logger,
	})
	if err != nil {
		logger.Error("the link cannot be built", slog.Any("error", err))
		return
	}
	handler.client = client
	handler.reporter = link.NewReporter(runID, client, logger)
	handler.credentials = newCredentialBroker(client, a.Pairing.Unseal, a.Sessions.Get)
	a.Credentials = handler.credentials
	// State changes the session service observes become `agent.observed`
	// entries in the control plane's log.
	a.Sessions.SetPublisher(handler)
	a.Link = client
	client.Run(ctx)
}

/* ---------------------------------------------------------------- link.Handler */

func (h *linkHandler) Hello(ctx context.Context) (link.Hello, error) {
	facts, err := h.app.Host.Collect(ctx)
	if err != nil {
		return link.Hello{}, err
	}
	return link.Hello{
		RunnerVersion: h.app.Version,
		RunID:         h.reporter.RunID(),
		Host:          facts,
		Sessions:      h.snapshots(),
	}, nil
}

func (h *linkHandler) Heartbeat(ctx context.Context) (link.Heartbeat, error) {
	facts, err := h.app.Host.Collect(ctx)
	if err != nil {
		return link.Heartbeat{}, err
	}
	return link.Heartbeat{
		SentAt:   time.Now().UTC(),
		Channel:  string(h.identity.Channel),
		Host:     facts,
		Load:     link.Load{LoadAverage1m: loadAverage()},
		Sessions: h.snapshots(),
	}, nil
}

func (h *linkHandler) Connected(_ context.Context, epoch uint64) {
	h.mu.Lock()
	h.epoch = epoch
	h.mu.Unlock()
	// Whatever was not acked before the drop is sent again; the keys make the
	// resend free on the other side.
	h.reporter.Resend()
}

func (h *linkHandler) Disconnected(uint64) {
	// The control plane drained its attachment table when the socket went, so
	// every PTY here is streaming to nobody: close them, and the browsers
	// reattach through the next epoch with fresh ids.
	h.mu.Lock()
	open := h.attachments
	h.attachments = map[uint32]*attachment{}
	h.mu.Unlock()
	for _, att := range open {
		att.flow.close()
		att.cancel()
		_ = att.pty.Close()
	}
}

func (h *linkHandler) Frame(_ context.Context, attachmentID uint32, bytes []byte) {
	// Keystrokes ride `session.input` today; a binary frame towards the host
	// is the symmetric path and is written straight to the PTY.
	if att := h.attachmentByID(attachmentID); att != nil {
		_, _ = att.pty.Write(bytes)
	}
}

func (h *linkHandler) Message(ctx context.Context, msg link.Message) {
	switch msg.Type {
	case "events.ack":
		var ack link.EventsAck
		if msg.Decode(&ack) == nil {
			h.reporter.Ack(ack)
		}
	case "command.failed":
		var failed link.CommandFailed
		if msg.Decode(&failed) == nil {
			// The only commands this runner issues are credential asks; a
			// failure naming one of them is that ask's answer.
			if !h.credentials.Refuse(failed.CommandID, fmt.Errorf("%s: %s", failed.Code, failed.Detail)) {
				h.logger.Warn("command.failed for an unknown command", slog.String("command", failed.CommandID))
			}
		}
	case "hint":
		var hint link.Hint
		if msg.Decode(&hint) == nil {
			h.logger.Warn("hint from the control plane", slog.String("kind", hint.Kind), slog.String("detail", hint.Detail))
		}
	case "session.create":
		var m link.SessionCreate
		if msg.Decode(&m) == nil {
			h.create(ctx, m)
		}
	case "session.attach":
		var m link.SessionAttach
		if msg.Decode(&m) == nil {
			h.attach(ctx, m)
		}
	case "session.input":
		var m link.SessionInput
		if msg.Decode(&m) == nil {
			h.input(ctx, m)
		}
	case "session.resize":
		var m link.SessionResize
		if msg.Decode(&m) == nil {
			h.resize(m)
		}
	case "session.detach":
		var m link.SessionDetach
		if msg.Decode(&m) == nil {
			h.detach(m.AttachmentID)
		}
	case "session.stop", "session.restart", "session.close", "session.window.open", "session.window.close":
		var m link.SessionCommand
		if msg.Decode(&m) == nil {
			h.lifecycle(ctx, m)
		}
	case "attachment.credit":
		var m link.AttachmentCredit
		if msg.Decode(&m) == nil {
			if att := h.attachmentByID(m.AttachmentID); att != nil {
				att.flow.credit(m.Bytes)
			}
		}
	case "credentials.grant":
		var m link.CredentialsGrant
		if msg.Decode(&m) == nil {
			h.credentials.Grant(m)
		}
	case "credentials.revoke":
		var m link.CredentialsRevoke
		if msg.Decode(&m) == nil {
			h.credentials.Revoke(m.SessionID)
		}
	case "host.preflight":
		var m link.SessionCommand
		if msg.Decode(&m) == nil {
			h.preflight(ctx, m.CommandID)
		}
	case "host.update":
		var m link.HostUpdate
		if msg.Decode(&m) == nil {
			h.update(ctx, m)
		}
	default:
		h.logger.Warn("unknown message from the control plane", slog.String("type", msg.Type))
	}
}

/* --------------------------------------------------------- sessions.Publisher */

// SessionChanged is the session service's publisher: an observed state is a
// log entry the control plane folds the sidebar dot from.
func (h *linkHandler) SessionChanged(session sessionsdomain.Session) {
	if h.reporter == nil {
		return
	}
	switch session.State {
	case sessionsdomain.StateStopped:
		h.reporter.Append(session.ID, "session.stopped", map[string]any{"source": "host"})
	case sessionsdomain.StateClosed:
		h.reporter.Append(session.ID, "session.closed", map[string]any{"dirty": session.Dirty})
	default:
		payload := map[string]any{"state": observedOf(session.State)}
		if session.LoginURL != "" {
			payload["loginUrl"] = session.LoginURL
		}
		h.reporter.Append(session.ID, "agent.observed", payload)
	}
}

/* ------------------------------------------------------------------ commands */

func (h *linkHandler) create(ctx context.Context, m link.SessionCreate) {
	agent, ok := agentOf(m.Agent)
	if !ok {
		h.fail(m.CommandID, sessionsdomain.ErrInvalidInput.WithDetail("unknown agent %q", m.Agent))
		return
	}
	if len(m.Checkouts) == 0 {
		// A session with no checkout is a directory and a shell; this runner's
		// session service still needs a repository to make one.
		h.fail(m.CommandID, sessionsdomain.ErrInvalidInput.WithDetail("a session needs at least one checkout on this runner"))
		return
	}
	first := m.Checkouts[0]
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

func (h *linkHandler) attach(ctx context.Context, m link.SessionAttach) {
	pty, err := h.app.Sessions.Attach(ctx, m.SessionID, m.Window, sessionsapp.Size{Cols: clampSize(m.Cols), Rows: clampSize(m.Rows)})
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	readCtx, cancel := context.WithCancel(context.Background())
	att := &attachment{id: m.AttachmentID, sessionID: m.SessionID, window: m.Window, pty: pty, cancel: cancel, flow: newFlowWindow()}
	h.mu.Lock()
	if previous, exists := h.attachments[m.AttachmentID]; exists {
		previous.flow.close()
		previous.cancel()
		_ = previous.pty.Close()
	}
	h.attachments[m.AttachmentID] = att
	h.mu.Unlock()
	go h.pump(readCtx, att)
}

// pump is the one goroutine reading an attachment's PTY: one read, one frame.
func (h *linkHandler) pump(ctx context.Context, att *attachment) {
	buf := make([]byte, ptyRead)
	for {
		// Flow control: the read waits while the browser's window is spent,
		// so tmux's own buffer, not this process, holds a runaway pane.
		if !att.flow.acquire(ctx) {
			return
		}
		n, err := att.pty.Read(buf)
		if n > 0 {
			att.flow.sent(n)
			if sendErr := h.client.SendFrame(att.id, buf[:n]); sendErr != nil && !errors.Is(sendErr, link.ErrBackpressure) {
				break
			}
		}
		if err != nil {
			break
		}
		if ctx.Err() != nil {
			return
		}
	}
	if ctx.Err() != nil {
		return
	}
	// The PTY ended on its own — the window closed, or tmux went — so the id
	// is free and the control plane is told.
	h.mu.Lock()
	if h.attachments[att.id] == att {
		delete(h.attachments, att.id)
	}
	h.mu.Unlock()
	_ = att.pty.Close()
	_ = h.client.Send(link.AttachmentClosed{Type: "attachment.closed", AttachmentID: att.id, Reason: "pty closed"})
}

func (h *linkHandler) input(ctx context.Context, m link.SessionInput) {
	data, err := base64.StdEncoding.DecodeString(m.Data)
	if err != nil || len(data) == 0 {
		return
	}
	// A window someone is watching takes the bytes on its PTY, which is how
	// mouse reports and escape sequences arrive intact; an unwatched window
	// gets them typed through tmux.
	if att := h.attachmentFor(m.SessionID, m.Window); att != nil {
		_, _ = att.pty.Write(data)
		return
	}
	if err := h.app.Sessions.Send(ctx, m.SessionID, m.Window, string(data)); err != nil {
		h.fail(m.CommandID, err)
	}
}

func (h *linkHandler) resize(m link.SessionResize) {
	if att := h.attachmentByID(m.AttachmentID); att != nil {
		_ = att.pty.Resize(sessionsapp.Size{Cols: clampSize(m.Cols), Rows: clampSize(m.Rows)})
	}
}

func (h *linkHandler) detach(id uint32) {
	h.mu.Lock()
	att := h.attachments[id]
	delete(h.attachments, id)
	h.mu.Unlock()
	if att != nil {
		att.flow.close()
		att.cancel()
		_ = att.pty.Close()
	}
}

func (h *linkHandler) lifecycle(ctx context.Context, m link.SessionCommand) {
	var err error
	switch m.Type {
	case "session.stop":
		_, err = h.app.Sessions.Stop(ctx, m.SessionID)
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

/* ------------------------------------------------------------------- helpers */

func (h *linkHandler) fail(commandID string, err error) {
	code, detail := "RUNNER_000", err.Error()
	if pe := problem.From(err); pe != nil && pe.Code != "" {
		code = pe.Code
		if pe.Detail != "" {
			detail = pe.Detail
		}
	}
	h.logger.Warn("command failed", slog.String("command", commandID), slog.String("code", code), slog.String("detail", detail))
	_ = h.client.Send(link.CommandFailed{Type: "command.failed", CommandID: commandID, Code: code, Detail: truncate(detail, 500)})
}

func failurePayload(err error) map[string]any {
	payload := map[string]any{"detail": truncate(err.Error(), 500)}
	if pe := problem.From(err); pe != nil && pe.Code != "" {
		payload["code"] = pe.Code
	}
	return payload
}

func (h *linkHandler) attachmentByID(id uint32) *attachment {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.attachments[id]
}

func (h *linkHandler) attachmentFor(sessionID string, window int) *attachment {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, att := range h.attachments {
		if att.sessionID == sessionID && att.window == window {
			return att
		}
	}
	return nil
}

func (h *linkHandler) snapshots() []link.SessionSnapshot {
	sessions := h.app.Sessions.List()
	out := make([]link.SessionSnapshot, 0, len(sessions))
	now := time.Now()
	for _, s := range sessions {
		if !s.State.Live() {
			continue
		}
		snapshot := link.SessionSnapshot{
			SessionID:    s.ID,
			Agent:        protocolAgent(s.Agent),
			Observed:     observedOf(s.State),
			StateSeconds: int(now.Sub(s.Updated).Seconds()),
			Windows:      []link.Window{},
		}
		for _, w := range s.Windows {
			snapshot.Windows = append(snapshot.Windows, link.Window{Index: w.Index, Name: w.Name})
		}
		if s.LoginURL != "" {
			url := s.LoginURL
			snapshot.LoginURL = &url
		}
		out = append(out, snapshot)
	}
	return out
}

func agentOf(id string) (sessionsdomain.Agent, bool) {
	switch id {
	case "claude-code":
		return sessionsdomain.AgentClaude, true
	case "codex":
		return sessionsdomain.AgentCodex, true
	}
	return "", false
}

func protocolAgent(agent sessionsdomain.Agent) string {
	switch agent {
	case sessionsdomain.AgentCodex:
		return "codex"
	default:
		return "claude-code"
	}
}

// observedOf maps the runner's states onto the five the log's
// `agent.observed` takes; the lifecycle ones never reach here.
func observedOf(state sessionsdomain.State) string {
	switch state {
	case sessionsdomain.StateWorking, sessionsdomain.StateBlocked, sessionsdomain.StateIdle, sessionsdomain.StateDone:
		return string(state)
	default:
		return "unknown"
	}
}

func clampSize(v int) uint16 {
	switch {
	case v < 1:
		return 1
	case v > 10_000:
		return 10_000
	}
	return uint16(v)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// Attachment ids are printed in logs as hex, for a person matching them to
// the control plane's; nothing parses them back.
func (att *attachment) String() string { return fmt.Sprintf("attachment#%08x", att.id) }
