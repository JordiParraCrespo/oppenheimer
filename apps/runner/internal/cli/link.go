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

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/adapters/system"
	hostdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
	pairdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/pairing/domain"
	sessionsapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/app"
	sessionsdomain "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// ptyRead is the PTY read buffer, 02-runner §5's 32 KB: one read is one frame.
const ptyRead = 32 * 1024

// attachmentInput bounds the keystroke frames one attachment can have waiting
// for its PTY. A PTY that has not taken 64 frames has a wedged client behind
// it, and the attachment is closed rather than let it stall the read loop —
// the same policy as a slow WebSocket consumer (packages/go/ws).
const attachmentInput = 64

// eventRetry is how often event batches the link refused while it stayed up —
// a full control queue — are offered to it again.
const eventRetry = 5 * time.Second

// Host commands run off the read loop too, each on a lane of its own: a
// preflight must not queue behind a download that can take minutes. A lane
// key is otherwise a session id, a UUID, so these cannot collide with one.
const (
	laneHostUpdate    = "host:update"
	laneHostPreflight = "host:preflight"
)

// linkSender is the slice of the link the handler writes through, so a test
// can capture what it sends.
type linkSender interface {
	Send(message any) error
	SendFrame(ctx context.Context, attachmentID uint32, bytes []byte) error
}

// linkHandler is what the link does to this host: the composition root's
// mapping from 01's messages onto the session service. It owns the open
// attachments — the PTYs behind the browser's terminals — because they are
// the one thing that is neither a session (they outlive none) nor the link
// (they outlive no epoch).
type linkHandler struct {
	app      *App
	identity pairdomain.Identity
	logger   *slog.Logger
	client   linkSender
	reporter *link.Reporter

	credentials *credentialBroker
	// httpClient pulls parked images; nil is a default client (link_images.go).
	httpClient *http.Client
	// bootToken mints the assertion an image pull carries.
	bootToken func(ctx context.Context) (string, error)

	// life is the daemon's context, not a link's. Session commands run on it
	// (02-runner §4): a link that drops mid-clone must not take the clone
	// with it, and a stop queued behind a create must not run on a socket
	// that is already gone. Outcomes travel through the reporter, which
	// resends them on the next link.
	//
	// It ends only when the daemon does, or when the host is unpaired
	// (endLife): no command runs for a host that is no longer one.
	life    context.Context
	endLife context.CancelFunc
	// lanes orders each session's commands off the read loop.
	lanes *lanes

	mu          sync.Mutex
	attachments map[uint32]*attachment
	epoch       uint64
	// linkUp is whether epoch's link is still up. Disconnected clears it
	// without a new epoch, so an attach finishing after the drop sees that
	// the link it was for is gone.
	linkUp bool
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
	// epoch is the link that allocated the id, for the log.
	epoch uint64
	// input is the keystrokes waiting for the PTY. inputPump writes them, so
	// a PTY that stops taking them never blocks the read loop.
	input chan []byte
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
	life, endLife := context.WithCancel(ctx)
	defer endLife()
	handler := &linkHandler{
		app: a, identity: identity, logger: logger, attachments: map[uint32]*attachment{}, decided: map[string]bool{},
		bootToken: a.Pairing.BootToken, life: life, endLife: endLife, lanes: newLanes(),
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
			handler.unpaired(ctx)
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
	go handler.retryEvents(life)
	// Run returns only when ctx ends or the host was unpaired. A lost or
	// ended link leaves sessions running in tmux: ending someone's work is not
	// a side effect of losing the control plane. Unpaired is the exception,
	// because it is a decision (OnUnpaired above).
	_ = client.Run(ctx)
}

// unpairedDrain bounds how long an unpaired host waits for the commands it
// was running to return before it stops its sessions anyway.
const unpairedDrain = 30 * time.Second

// unpairedRetry is how long an unpaired host waits before trying again to stop
// a session it could not; it doubles up to unpairedRetryMax. A var so a test
// need not wait a real second.
var (
	unpairedRetry    = time.Second
	unpairedRetryMax = time.Minute
)

// unpaired is a person removing this host, and removing a host stops the
// sessions on it (03, 14): the control plane has already recorded each one
// stopped, and the remove dialog promised their terminals close. An agent left
// running here would keep working where no console can see it. Stopping keeps
// every checkout on disk — it is not a close.
//
// The order is the point. Commands in flight are cancelled and the lanes
// closed and drained first, so a create still cloning cannot start its tmux
// session after the stop has already looked; then every session goes. A
// create that got as far as tmux before the cancel is ended by the same stop.
//
// There is no second verdict to try again on, so a stop that fails is retried
// for as long as the daemon lives — which, unpaired, is quietly, until the
// service manager stops it.
func (h *linkHandler) unpaired(ctx context.Context) {
	if h.endLife != nil {
		h.endLife()
	}
	if !h.lanes.close(unpairedDrain) {
		h.logger.Warn("commands were still running when this host was unpaired; stopping its sessions anyway")
	}
	wait := unpairedRetry
	for {
		ended, err := h.app.Sessions.EndAll(context.WithoutCancel(ctx))
		if len(ended) > 0 {
			h.logger.Info("stopped the sessions of this unpaired host", slog.Any("sessions", ended))
		}
		if err == nil {
			return
		}
		h.logger.Error("could not stop every session of this unpaired host; trying again",
			slog.Any("error", err), slog.Duration("in", wait))
		select {
		case <-ctx.Done():
			return
		case <-time.After(wait):
		}
		wait = min(wait*2, unpairedRetryMax)
	}
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
	return h.heartbeatFrom(facts), nil
}

// heartbeatFrom is a heartbeat around facts already collected.
func (h *linkHandler) heartbeatFrom(facts hostdomain.Facts) link.Heartbeat {
	return link.Heartbeat{
		SentAt:   time.Now().UTC(),
		Channel:  string(h.identity.Channel),
		Host:     facts,
		Load:     link.Load{LoadAverage1m: loadAverage(), MemoryAvailableBytes: system.AvailableMemory()},
		Sessions: h.snapshots(),
	}
}

// currentEpoch is the epoch of the link that is up, or of the last one.
func (h *linkHandler) currentEpoch() uint64 {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.epoch
}

// liveEpoch reports whether epoch's link is the one up.
func (h *linkHandler) liveEpoch(epoch uint64) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.linkUp && h.epoch == epoch
}

func (h *linkHandler) Connected(_ context.Context, epoch uint64) {
	h.mu.Lock()
	h.epoch, h.linkUp = epoch, true
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
	h.linkUp = false
	h.mu.Unlock()
	for _, att := range open {
		att.flow.close()
		att.cancel()
		_ = att.pty.Close()
	}
}

// Frame is a browser's keystrokes for an attachment. It runs on the read
// loop, so it only queues them: the attachment's inputPump writes them to the
// PTY, whose write blocks once the client behind it stops reading.
func (h *linkHandler) Frame(_ context.Context, attachmentID uint32, bytes []byte) {
	att := h.attachmentByID(attachmentID)
	if att == nil {
		return
	}
	// The frame may be a view into the read buffer, which is not ours to keep.
	frame := append([]byte(nil), bytes...)
	select {
	case att.input <- frame:
	default:
		// The PTY has not drained a full queue: the client behind it is
		// wedged. Close this attachment rather than stall every other one on
		// the link; the browser reattaches.
		if h.release(att) {
			h.logger.Warn("attachment input stalled; closing it",
				slog.String("attachment", att.String()), slog.Uint64("epoch", att.epoch))
			go h.closeAttachment(att, "input stalled")
		}
	}
}

// Message runs on the link's read loop and never waits: anything slower than
// a map lookup or an ioctl goes to a lane, on the daemon's context. The read
// loop is what takes the pongs, so a message handled here that blocked would
// take the link down with it.
func (h *linkHandler) Message(_ context.Context, msg link.Message) {
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
			h.lanes.run(m.SessionID, func() { h.create(h.life, m) })
		}
	case "session.attach":
		var m link.SessionAttach
		if msg.Decode(&m) == nil {
			// An attachment id belongs to the link that allocated it; one
			// queued past that link's end is dropped, and the browser
			// reattaches through the next. attach checks again once its PTY
			// is open, since the link can drop while tmux attaches.
			epoch := h.currentEpoch()
			h.lanes.run(m.SessionID, func() {
				if h.liveEpoch(epoch) {
					h.attach(h.life, m, epoch)
				}
			})
		}
	case "session.input":
		var m link.SessionInput
		if msg.Decode(&m) == nil {
			h.lanes.run(m.SessionID, func() { h.input(h.life, m) })
		}
	case "session.image":
		var m link.SessionImage
		if msg.Decode(&m) == nil {
			h.lanes.run(m.SessionID, func() { h.image(h.life, m) })
		}
	case "session.resize":
		var m link.SessionResize
		if msg.Decode(&m) == nil {
			// An ioctl on an open PTY, done here like a credit, so a resize
			// never waits behind an image paste in the session's lane. One
			// for an attachment still being opened keeps its place behind
			// the attach, in the lane.
			if !h.resize(m) {
				h.lanes.run(m.SessionID, func() { h.resize(m) })
			}
		}
	case "session.detach":
		var m link.SessionDetach
		if msg.Decode(&m) == nil {
			h.lanes.run(m.SessionID, func() { h.detach(m.AttachmentID) })
		}
	case "session.stop", "session.restart", "session.close", "session.window.open", "session.window.close":
		var m link.SessionCommand
		if msg.Decode(&m) == nil {
			h.lanes.run(m.SessionID, func() { h.lifecycle(h.life, m) })
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
			h.lanes.run(laneHostPreflight, func() { h.preflight(h.life, m.CommandID) })
		}
	case "host.update":
		var m link.HostUpdate
		if msg.Decode(&m) == nil {
			// On the daemon's context, not the link's: a download that
			// outlives the link it was asked on still finishes. A failure goes
			// out on whatever link is up when it returns; one that returns
			// between links is only logged, as a create's is.
			h.lanes.run(laneHostUpdate, func() { h.update(h.life, m) })
		}
	default:
		h.logger.Warn("unknown message from the control plane", slog.String("type", msg.Type))
	}
}

// retryEvents offers the link, for as long as the daemon lives, the event
// batches it refused while it stayed up; a reconnect resends on its own.
func (h *linkHandler) retryEvents(ctx context.Context) {
	ticker := time.NewTicker(eventRetry)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			h.reporter.Retry()
		}
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
