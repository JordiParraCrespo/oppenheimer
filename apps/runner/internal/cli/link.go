package cli

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
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
	// httpClient pulls parked images; nil is a default client (link_images.go).
	httpClient *http.Client
	// bootToken mints the assertion an image pull carries.
	bootToken func(ctx context.Context) (string, error)

	mu          sync.Mutex
	attachments map[uint32]*attachment
	epoch       uint64
	// decided holds the sessions whose stop the control plane ordered: the
	// API already wrote that entry, so the observation it causes is not
	// reported a second time. A stop the host sees on its own — tmux gone
	// after a reboot — is still its to report.
	decided map[string]bool
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
	handler := &linkHandler{
		app: a, identity: identity, logger: logger, attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		bootToken: a.Pairing.BootToken,
	}
	client, err := link.New(link.Options{
		ControlPlaneURL: identity.ControlPlaneURL,
		Token:           a.Pairing.BootToken,
		Fingerprint:     identity.Fingerprint,
		Handler:         handler,
		UserAgent:       "oppenheimer-runner/" + a.Version,
		Logger:          logger,
		// Unpaired is terminal. Recorded in the identity so the next boot does
		// not dial either and `runner status` can say why the host is quiet.
		OnUnpaired: func() {
			if _, err := a.Pairing.MarkRevoked(); err != nil {
				logger.Error("could not record that this host was unpaired", slog.Any("error", err))
			}
		},
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
	// Run returns only when ctx ends or the host was unpaired. Sessions carry
	// on in tmux either way: ending someone's work is `uninstall --force`'s
	// decision, not a side effect of losing the control plane.
	_ = client.Run(ctx)
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
		Capabilities:  []string{link.CapabilitySessionImage},
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
	case "session.image":
		var m link.SessionImage
		if msg.Decode(&m) == nil {
			h.image(ctx, m)
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
		h.mu.Lock()
		ordered := h.decided[session.ID]
		delete(h.decided, session.ID)
		h.mu.Unlock()
		if ordered {
			// One action, one entry: the control plane recorded the stop it ordered.
			return
		}
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
			Agent:        s.Agent.CatalogID(),
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
